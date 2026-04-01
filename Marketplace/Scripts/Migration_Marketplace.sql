-- ============================================================
-- Marketplace Migration Script
-- Run this against the MKS database
-- ============================================================

-- 1. Create MarketplaceAccount table (Customer Auth)
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'MarketplaceAccount')
BEGIN
    CREATE TABLE [dbo].[MarketplaceAccount] (
        [ID]            INT             IDENTITY(1,1) NOT NULL,
        [CustomerID]    INT             NOT NULL,
        [Email]         NVARCHAR(200)   NOT NULL,
        [PasswordHash]  VARBINARY(64)   NOT NULL,
        [PasswordSalt]  VARBINARY(128)  NOT NULL,
        CONSTRAINT [PK_MarketplaceAccount] PRIMARY KEY CLUSTERED ([ID]),
        CONSTRAINT [FK_MarketplaceAccount_Customer] FOREIGN KEY ([CustomerID]) REFERENCES [dbo].[Customer]([ID]),
        CONSTRAINT [UQ_MarketplaceAccount_Email] UNIQUE ([Email]),
        CONSTRAINT [UQ_MarketplaceAccount_CustomerID] UNIQUE ([CustomerID])
    );
    PRINT 'Table MarketplaceAccount created.';
END
ELSE
    PRINT 'Table MarketplaceAccount already exists.';
GO

-- 2. Add ImageUrl column to Product table
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Product' AND COLUMN_NAME = 'ImageUrl')
BEGIN
    ALTER TABLE [dbo].[Product] ADD [ImageUrl] NVARCHAR(500) NULL;
    PRINT 'Column Product.ImageUrl added.';
END
ELSE
    PRINT 'Column Product.ImageUrl already exists.';
GO
