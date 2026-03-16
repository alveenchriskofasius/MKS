-- =============================================
-- Create SalesPerson table (child of Supplier)
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SalesPerson')
BEGIN
    CREATE TABLE [dbo].[SalesPerson] (
        [ID]         INT            IDENTITY(1,1) NOT NULL,
        [SupplierID] INT            NOT NULL,
        [Name]       NVARCHAR(200)  NOT NULL,
        [Company]    NVARCHAR(200)  NULL,
        [Contact]    NVARCHAR(100)  NULL,
        [IsActive]   BIT            NOT NULL DEFAULT 1,
        CONSTRAINT [PK_SalesPerson] PRIMARY KEY CLUSTERED ([ID]),
        CONSTRAINT [FK_SalesPerson_Customer] FOREIGN KEY ([SupplierID])
            REFERENCES [dbo].[Customer]([ID])
    );
    CREATE INDEX [IX_SalesPerson_SupplierID] ON [dbo].[SalesPerson]([SupplierID]);
END
GO

-- Add SalesPersonID to Consignment (nullable FK)
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Consignment') AND name = 'SalesPersonID')
BEGIN
    ALTER TABLE [dbo].[Consignment] ADD [SalesPersonID] INT NULL;
    ALTER TABLE [dbo].[Consignment] ADD CONSTRAINT [FK_Consignment_SalesPerson]
        FOREIGN KEY ([SalesPersonID]) REFERENCES [dbo].[SalesPerson]([ID]);
END
GO

-- Migrate existing IsSales customers to SalesPerson table (if any exist)
INSERT INTO [dbo].[SalesPerson] ([SupplierID], [Name], [Company], [Contact], [IsActive])
SELECT c2.[ID], c1.[Name], c1.[Company], c1.[ContactNumber], 1
FROM [dbo].[Customer] c1
CROSS JOIN (SELECT TOP 1 [ID] FROM [dbo].[Customer] WHERE [IsSupplier] = 1) c2
WHERE c1.[IsSales] = 1
  AND NOT EXISTS (SELECT 1 FROM [dbo].[SalesPerson] sp WHERE sp.[Name] = c1.[Name]);
GO
