-- How many classes a course is expected to hold in a semester — the
-- denominator for a student's semester attendance percentage on the
-- lecturer's Courses page (present classes / this number, capped at 100%).
-- Admin-editable from Settings; defaults to 12.

ALTER TABLE system_settings
  ADD COLUMN expected_classes_per_semester SMALLINT NOT NULL DEFAULT 12
    CHECK (expected_classes_per_semester BETWEEN 1 AND 100);
