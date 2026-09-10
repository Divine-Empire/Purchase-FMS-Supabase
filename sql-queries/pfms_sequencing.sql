-- =========================================================================
-- 1. SEQUENCE INITIALIZATION FOR PFMS
-- =========================================================================
CREATE SEQUENCE IF NOT EXISTS pfms_indent_no_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS pfms_lift_no_seq START WITH 1;

-- =========================================================================
-- 2. AUTOMATIC SYNCHRONIZATION WITH CURRENT DATA
-- =========================================================================

-- Sync Indent sequence with the highest current number in the "pfms_indent_generation" table
SELECT setval('pfms_indent_no_seq', COALESCE((
  SELECT MAX(substring("indentNo" from 'IN-([0-9]+)')::integer)
  FROM "pfms_indent_generation"
  WHERE "indentNo" ~ '^IN-[0-9]+'
), 0) + 1, false);

-- Sync Lift sequence with the highest current number in the "pfms_lift" table
SELECT setval('pfms_lift_no_seq', COALESCE((
  SELECT MAX(substring("liftNo" from 'LIFT-([0-9]+)')::integer)
  FROM "pfms_lift"
  WHERE "liftNo" ~* '^LIFT-[0-9]+'
), 0) + 1, false);

-- =========================================================================
-- 3. STORED FUNCTIONS FOR GENERATING BATCH IDs
-- =========================================================================

-- Function: Generate next Indent IDs (e.g. IN-123A, IN-123B)
CREATE OR REPLACE FUNCTION pfms_generate_next_indent_no(batch_size integer)
RETURNS text[] AS $$
DECLARE
  next_val bigint;
  new_ids text[] := '{}';
  i integer;
  num_str text;
BEGIN
  -- Increment and get the next unique batch number
  next_val := nextval('pfms_indent_no_seq');

  -- Determine formatting: pad to 3 digits if < 1000, otherwise let it expand
  IF next_val < 1000 THEN
    num_str := lpad(next_val::text, 3, '0');
  ELSE
    num_str := next_val::text;
  END IF;

  -- Append character suffixes (A, B, C...) for each item in the batch
  FOR i IN 0..(batch_size - 1) LOOP
    new_ids := array_append(new_ids, 'IN-' || num_str || chr(65 + i));
  END LOOP;

  RETURN new_ids;
END;
$$ LANGUAGE plpgsql;

-- Function: Generate next Lift IDs (e.g. LIFT-001, LIFT-002)
CREATE OR REPLACE FUNCTION pfms_generate_next_lift_nos(batch_size integer)
RETURNS text[] AS $$
DECLARE
  new_ids text[] := '{}';
  i integer;
  curr_val bigint;
  num_str text;
BEGIN
  -- Retrieve an incremented sequence number for each lift in the batch
  FOR i IN 1..batch_size LOOP
    curr_val := nextval('pfms_lift_no_seq');
    
    -- Pad to 3 digits if < 1000, otherwise let it expand
    IF curr_val < 1000 THEN
      num_str := lpad(curr_val::text, 3, '0');
    ELSE
      num_str := curr_val::text;
    END IF;
    
    new_ids := array_append(new_ids, 'LIFT-' || num_str);
  END LOOP;

  RETURN new_ids;
END;
$$ LANGUAGE plpgsql;

-- Grant execution privileges to API roles
GRANT EXECUTE ON FUNCTION pfms_generate_next_indent_no(integer) TO service_role, anon, authenticated;
GRANT EXECUTE ON FUNCTION pfms_generate_next_lift_nos(integer) TO service_role, anon, authenticated;
