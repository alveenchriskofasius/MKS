-- Migration: Fix historical Purchase Order records that have wrong TradeTypeID
-- Purpose: PO records were previously created with TradeTypeID = 4 (MarketplaceOrder)
--          instead of TradeTypeID = 1 (PurchaseOrder). This corrects existing data.
-- Safety: Only updates records whose Trade.No starts with 'MO' prefix (PO format)
--         and currently have TradeTypeID = 4.

-- Preview affected rows first (run this SELECT to verify before executing UPDATE)
-- SELECT ID, No, TradeTypeID, CreatedAt FROM [dbo].[Trade]
-- WHERE TradeTypeID = 4 AND No LIKE 'PO%';

BEGIN TRANSACTION;

UPDATE [dbo].[Trade]
SET TradeTypeID = 1
WHERE TradeTypeID = 4
  AND No LIKE 'PO%';

-- Verify the update
DECLARE @affected INT = @@ROWCOUNT;
PRINT 'Updated ' + CAST(@affected AS NVARCHAR(10)) + ' PO records from TradeTypeID 4 to 1.';

-- Uncomment COMMIT when ready, or ROLLBACK to cancel
-- COMMIT;
ROLLBACK;
GO
