-- Add PurchasePrice column to Product table
-- This column stores the buying price from supplier (harga beli)
-- UnitPrice remains as the selling price (harga jual)

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'Product' AND COLUMN_NAME = 'PurchasePrice'
)
BEGIN
    ALTER TABLE [dbo].[Product]
    ADD [PurchasePrice] DECIMAL(10, 2) NOT NULL DEFAULT 0;
    
    PRINT 'Column PurchasePrice added to Product table.';
END
ELSE
BEGIN
    PRINT 'Column PurchasePrice already exists in Product table.';
END
GO
