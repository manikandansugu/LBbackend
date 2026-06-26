import { InferSchemaType, Schema, model } from "mongoose";

const messageSchema = new Schema(
  {
    conversationKey: {
      type: String,
      required: true,
      index: true,
    },
    fromUser: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    toUser: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

export type Message = InferSchemaType<typeof messageSchema>;

const MessageModel = model<Message>("Message", messageSchema);

export default MessageModel;
