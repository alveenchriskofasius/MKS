-- Migration: Add Marketplace Order as separate TradeType
-- TradeTypeID 4 = Marketplace Order (MO)
-- Existing: 1=PO, 2=SO, 3=Invoice, 5=SalesReturn

IF NOT EXISTS (SELECT 1 FROM TradeType WHERE ID = 4)
BEGIN
    SET IDENTITY_INSERT TradeType ON;
    INSERT INTO TradeType (ID, No, Name) VALUES (4, 'MO', 'Marketplace Order');
    SET IDENTITY_INSERT TradeType OFF;
END

-- Migrate existing MO-prefixed trades from TradeTypeID 2 to 4
UPDATE Trade SET TradeTypeID = 4 WHERE TradeTypeID = 2 AND No LIKE 'MO%';

PRINT 'Migration complete: Marketplace Order TradeType added and existing MO trades migrated.';
