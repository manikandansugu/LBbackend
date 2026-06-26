import { Server } from "socket.io";
import type { Server as HttpServer } from "http";
import type { QueryFilter } from "mongoose";
import Call, { type CallLog } from "./models/call.model";
import Message from "./models/message.model";
import User from "./models/user.model";
import { getConversationKey } from "./utils/chat";
import { verify_token } from "./utils/helpers";

type SendMessagePayload = {
  text?: string;
  toUserId?: string;
};

type TypingPayload = {
  isTyping?: boolean;
  toUserId?: string;
};

type VoiceCallInvitePayload = {
  callId?: string;
  callLogId?: string;
  callerImageUrl?: string;
  callerName?: string;
  toUserId?: string;
};

type VoiceCallSignalPayload = {
  callId?: string;
  callLogId?: string;
  toUserId?: string;
};

type CallInviteEvent = "voice_call_invite" | "video_call_invite";
type CallSignalEvent =
  | "voice_call_accept"
  | "voice_call_reject"
  | "voice_call_end"
  | "video_call_accept"
  | "video_call_reject"
  | "video_call_end";

type CallMediaType = "voice" | "video";

const getCallSignalFilter = (
  payload: VoiceCallSignalPayload,
  currentUserId: string,
): QueryFilter<CallLog> | null => {
  if (!payload.callId || !payload.toUserId) {
    return null;
  }

  const participantFilter = {
    $or: [
      { initiator: currentUserId, receiver: payload.toUserId },
      { initiator: payload.toUserId, receiver: currentUserId },
    ],
  };

  if (payload.callLogId) {
    return {
      callLogId: payload.callLogId,
      ...participantFilter,
    };
  }

  return {
    callId: payload.callId,
    ...participantFilter,
    status: { $in: ["ringing", "accepted"] as const },
  };
};

export const configureSocket = (server: HttpServer) => {
  const io = new Server(server, {
    cors: {
      origin: "*",
    },
  });
  const onlineUsers = new Map<string, Set<string>>();

  const addOnlineSocket = (userId: string, socketId: string) => {
    const userSockets = onlineUsers.get(userId) ?? new Set<string>();
    const wasOffline = userSockets.size === 0;

    userSockets.add(socketId);
    onlineUsers.set(userId, userSockets);

    if (wasOffline) {
      io.emit("presence_update", { userId, isOnline: true });
    }
  };

  const removeOnlineSocket = (userId: string, socketId: string) => {
    const userSockets = onlineUsers.get(userId);

    if (!userSockets) {
      return;
    }

    userSockets.delete(socketId);

    if (userSockets.size) {
      onlineUsers.set(userId, userSockets);
      return;
    }

    onlineUsers.delete(userId);
    io.emit("presence_update", { userId, isOnline: false });
  };

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;

      if (!token) {
        return next(new Error("Authorization token is required"));
      }

      const tokenSubject = verify_token(token);
      const user = await User.findOne({
        $or: [{ email: tokenSubject }, { phoneNumber: tokenSubject }],
      });

      if (!user) {
        return next(new Error("User not found"));
      }

      socket.data.userId = user._id.toString();
      socket.join(socket.data.userId);
      next();
    } catch (error) {
      next(error instanceof Error ? error : new Error("Socket auth failed"));
    }
  });

  io.on("connection", socket => {
    addOnlineSocket(socket.data.userId, socket.id);
    socket.emit("online_users", Array.from(onlineUsers.keys()));

    socket.on("get_online_users", ack => {
      ack?.(Array.from(onlineUsers.keys()));
    });

    socket.on("join_conversation", (otherUserId: string) => {
      if (!otherUserId) {
        return;
      }

      socket.join(getConversationKey(socket.data.userId, otherUserId));
    });

    socket.on("typing", (payload: TypingPayload) => {
      const toUserId = payload.toUserId;

      if (!toUserId) {
        return;
      }

      io.to(toUserId).emit("typing_update", {
        fromUserId: socket.data.userId,
        isTyping: Boolean(payload.isTyping),
      });
    });

    const relayCallInvite = (
      eventName: CallInviteEvent,
      payload: VoiceCallInvitePayload,
    ) => {
      const toUserId = payload.toUserId;

      if (!toUserId || !payload.callId) {
        return;
      }

      const callLogId =
        payload.callLogId ||
        `${payload.callId}:${socket.data.userId}:${toUserId}:${Date.now()}`;

      io.to(toUserId).emit(eventName, {
        callId: payload.callId,
        callLogId,
        callerImageUrl: payload.callerImageUrl,
        callerName: payload.callerName,
        fromUserId: socket.data.userId,
      });

      const mediaType: CallMediaType = eventName.startsWith("video")
        ? "video"
        : "voice";

      const startedAt = new Date();

      Call.findOneAndUpdate(
        { callLogId },
        {
          $setOnInsert: {
            callId: payload.callId,
            callLogId,
            durationSeconds: 0,
            initiator: socket.data.userId,
            mediaType,
            receiver: toUserId,
            startedAt,
            status: "ringing",
          },
        },
        { upsert: true },
      ).catch(error => {
        console.error("Call invite log failed:", error);
      });
    };

    socket.on("voice_call_invite", (payload: VoiceCallInvitePayload) => {
      relayCallInvite("voice_call_invite", payload);
    });

    socket.on("video_call_invite", (payload: VoiceCallInvitePayload) => {
      relayCallInvite("video_call_invite", payload);
    });

    const updateCallSignalLog = (
      eventName: CallSignalEvent,
      payload: VoiceCallSignalPayload,
    ) => {
      const callFilter = getCallSignalFilter(payload, socket.data.userId);

      if (!callFilter) {
        return;
      }

      if (eventName.endsWith("_accept")) {
        Call.findOneAndUpdate(
          { ...callFilter, status: "ringing" },
          { answeredAt: new Date(), status: "accepted" },
          { sort: { startedAt: -1 } },
        ).catch(error => {
          console.error("Call accept log failed:", error);
        });
        return;
      }

      if (eventName.endsWith("_reject")) {
        Call.findOneAndUpdate(
          { ...callFilter, status: "ringing" },
          {
            durationSeconds: 0,
            endedAt: new Date(),
            status: "missed",
          },
          { sort: { startedAt: -1 } },
        ).catch(error => {
          console.error("Call reject log failed:", error);
        });
        return;
      }

      Call.findOne(callFilter)
        .sort({ startedAt: -1 })
        .then(call => {
          if (!call) {
            return;
          }

          const endedAt = new Date();
          const durationSeconds =
            call.status === "accepted"
              ? Math.max(
                  0,
                  Math.round(
                    (endedAt.getTime() -
                      (call.answeredAt ?? call.startedAt).getTime()) /
                      1000,
                  ),
                )
              : 0;

          return Call.updateOne(
            { _id: call._id },
            {
              durationSeconds,
              endedAt,
              status: call.status === "accepted" ? "completed" : "missed",
            },
          );
        })
        .catch(error => {
          console.error("Call end log failed:", error);
        });
    };

    const relayVoiceCallSignal = (
      eventName: CallSignalEvent,
      payload: VoiceCallSignalPayload,
    ) => {
      const toUserId = payload.toUserId;

      if (!toUserId || !payload.callId) {
        return;
      }

      io.to(toUserId).emit(eventName, {
        callId: payload.callId,
        callLogId: payload.callLogId,
        fromUserId: socket.data.userId,
      });

      updateCallSignalLog(eventName, payload);
    };

    socket.on("voice_call_accept", (payload: VoiceCallSignalPayload) => {
      relayVoiceCallSignal("voice_call_accept", payload);
    });

    socket.on("voice_call_reject", (payload: VoiceCallSignalPayload) => {
      relayVoiceCallSignal("voice_call_reject", payload);
    });

    socket.on("voice_call_end", (payload: VoiceCallSignalPayload) => {
      relayVoiceCallSignal("voice_call_end", payload);
    });

    socket.on("video_call_accept", (payload: VoiceCallSignalPayload) => {
      relayVoiceCallSignal("video_call_accept", payload);
    });

    socket.on("video_call_reject", (payload: VoiceCallSignalPayload) => {
      relayVoiceCallSignal("video_call_reject", payload);
    });

    socket.on("video_call_end", (payload: VoiceCallSignalPayload) => {
      relayVoiceCallSignal("video_call_end", payload);
    });

    socket.on("send_message", async (payload: SendMessagePayload, ack) => {
      try {
        const text = payload.text?.trim();
        const toUserId = payload.toUserId;

        if (!text || !toUserId) {
          throw new Error("Message and recipient are required");
        }

        const conversationKey = getConversationKey(socket.data.userId, toUserId);
        const message = await Message.create({
          conversationKey,
          fromUser: socket.data.userId,
          toUser: toUserId,
          text,
        });

        io.to(conversationKey).emit("receive_message", message);
        io.to(toUserId).emit("receive_message", message);
        ack?.({ success: true, data: message });
      } catch (error) {
        ack?.({
          success: false,
          message:
            error instanceof Error ? error.message : "Message could not be sent",
        });
      }
    });

    socket.on("disconnect", () => {
      removeOnlineSocket(socket.data.userId, socket.id);
    });
  });
};
