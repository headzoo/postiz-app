ALTER TABLE "ChannelAnalyticsDailyPoint"
  ADD COLUMN "currentSnapshotAt" TIMESTAMP(3),
  ADD COLUMN "previousSnapshotAt" TIMESTAMP(3);
