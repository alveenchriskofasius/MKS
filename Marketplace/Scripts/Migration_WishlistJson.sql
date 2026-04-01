-- Migration: Add WishlistJson column to MarketplaceAccount
-- Run this on the MKS database

IF NOT EXISTS (
    SELECT 1 FROM sys.columns 
    WHERE object_id = OBJECT_ID('MarketplaceAccount') 
    AND name = 'WishlistJson'
)
BEGIN
    ALTER TABLE [dbo].[MarketplaceAccount]
    ADD [WishlistJson] NVARCHAR(MAX) NULL;
    PRINT 'Column WishlistJson added to MarketplaceAccount.';
END
ELSE
BEGIN
    PRINT 'Column WishlistJson already exists.';
END
GO
