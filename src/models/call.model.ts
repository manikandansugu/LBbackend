import { InferSchemaType, Schema, model } from "mongoose";

export const CALL_MEDIA_TYPES = ["voice", "video"] as const;
export const CALL_STATUSES = ["ringing", "accepted", "completed", "missed"] as const;

const callSchema = new Schema(
  {
    callId: {
      type: String,
      required: true,
      index: true,
    },
    callLogId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    answeredAt: {
      type: Date,
    },
    durationSeconds: {
      type: Number,
      default: 0,
      min: 0,
    },
    endedAt: {
      type: Date,
    },
    initiator: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    mediaType: {
      type: String,
      enum: CALL_MEDIA_TYPES,
      required: true,
    },
    receiver: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    startedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    status: {
      type: String,
      enum: CALL_STATUSES,
      default: "ringing",
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

callSchema.index({ initiator: 1, startedAt: -1 });
callSchema.index({ receiver: 1, startedAt: -1 });

export type CallLog = InferSchemaType<typeof callSchema>;

const CallModel = model<CallLog>("Call", callSchema);

export default CallModel;
