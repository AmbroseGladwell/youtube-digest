import { z } from "zod";
import { SYNCED_RECORD_KINDS, type SyncedRecordKind } from "@overview/domain";

export type RecordKind = SyncedRecordKind;

export const RecordKind = z.enum(SYNCED_RECORD_KINDS as [RecordKind, ...RecordKind[]]);

export const SETTINGS_RECORD_ID = "settings";
