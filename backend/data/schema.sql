
-- Suggested table for detections
CREATE TABLE IF NOT EXISTS detections (
  id TEXT NOT NULL,
  class TEXT NOT NULL,
  t TIMESTAMP NOT NULL,
  x REAL NOT NULL,
  y REAL NOT NULL,
  heading REAL,
  vest INTEGER,
  speed REAL,
  PRIMARY KEY (id, t)
);

CREATE INDEX IF NOT EXISTS idx_detections_t ON detections(t);
CREATE INDEX IF NOT EXISTS idx_detections_class ON detections(class);
