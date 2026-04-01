-- Migration: Add CartJson column to MarketplaceAccount
-- Purpose: Persist user shopping cart across login sessions

IF NOT EXISTS (
    SELECT 1 FROM sys.columns 
    WHERE object_id = OBJECT_ID('MarketplaceAccount') AND name = 'CartJson'
)
BEGIN
    ALTER TABLE [dbo].[MarketplaceAccount]
    ADD [CartJson] NVARCHAR(MAX) NULL;
END
GO
