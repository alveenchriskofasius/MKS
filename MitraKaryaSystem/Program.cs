using API.Context.SP;
using API.Context.Table;
using API.Repository;
using API.Repository.Interfaces;
using API.Services;
using API.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using MitraKaryaSystem.Security;

var builder = WebApplication.CreateBuilder(args);

// Find the directory where the executable is located
var exePath = System.Reflection.Assembly.GetEntryAssembly().Location;
var exeDirectory = Path.GetDirectoryName(exePath);

// Set up configuration
var config = new ConfigurationBuilder()
    .SetBasePath(exeDirectory)
    .AddJsonFile("appsettings.json", optional: false, reloadOnChange: true)
    .Build();

builder.Configuration.AddConfiguration(config); // Add shared configuratio
                                                // Add services to the container.
builder.Services.AddControllersWithViews();
builder.Services.AddAuthentication("AuthScheme").AddCookie("AuthScheme", options =>
    {
        options.LoginPath = "/Auth/Login"; // Set the login path
        options.LogoutPath = "/Auth/Logout"; // Set the logout path
        options.AccessDeniedPath = "/Auth/AccessDenied"; // Set the access denied path
        options.ReturnUrlParameter = "/Home/Index"; // Set the return URL parameter
    });

// Register the AuthService that implements the IAuthService interface
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IAuthRepository, AuthRepository>();
builder.Services.AddScoped<IUserService, UserService>();
builder.Services.AddScoped<IUserRepository, UserRepository>();
builder.Services.AddScoped<IRoleService, RoleService>();
builder.Services.AddScoped<IRoleRepository, RoleRepository>();
builder.Services.AddScoped<IProductService, ProductService>();
builder.Services.AddScoped<IProductRepository, ProductRepository>();
builder.Services.AddScoped<ICategoryService, CategoryService>();
builder.Services.AddScoped<ICategoryRepository, CategoryRepository>();
builder.Services.AddScoped<IUnitService, UnitService>();
builder.Services.AddScoped<IUnitRepository, UnitRepository>();
builder.Services.AddScoped<ISupplierService, SupplierService>();
builder.Services.AddScoped<ISupplierRepository, SupplierRepository>();
builder.Services.AddScoped<ICustomerRepository, CustomerRepository>();
builder.Services.AddScoped<ICustomerService, CustomerService>();
builder.Services.AddScoped<IPurchaseOrderRepository, PurchaseOrderRepository>();
builder.Services.AddScoped<IPurchaseOrderService, PurchaseOrderService>();
builder.Services.AddScoped<IStockInRepository, StockInRepository>();
builder.Services.AddScoped<IStockInService, StockInService>();
builder.Services.AddScoped<ISalesOrderService, SalesOrderService>();
builder.Services.AddScoped<ISalesOrderRepository, SalesOrderRepository>();
// Stock Count
builder.Services.AddScoped<IStockCountRepository, StockCountRepository>();
builder.Services.AddScoped<IStockCountService, StockCountService>();
// Returns
builder.Services.AddScoped<ISalesReturnRepository, SalesReturnRepository>();
builder.Services.AddScoped<ISalesReturnService, SalesReturnService>();
builder.Services.AddScoped<IPurchaseReturnRepository, PurchaseReturnRepository>();
builder.Services.AddScoped<IPurchaseReturnService, PurchaseReturnService>();
// Delivry Order
builder.Services.AddScoped<IDeliveryOrderRepository, DeliveryOrderRepository>();
builder.Services.AddScoped<IDeliveryOrderService, DeliveryOrderService>();
// Payment In
builder.Services.AddScoped<IPaymentInRepository, PaymentInRepository>();
builder.Services.AddScoped<IPaymentInService, PaymentInService>();
// Sales Invoice
builder.Services.AddScoped<ISalesInvoiceRepository, SalesInvoiceRepository>();
builder.Services.AddScoped<ISalesInvoiceService, SalesInvoiceService>();
builder.Services.AddScoped<IPaymentOutRepository, PaymentOutRepository>();
builder.Services.AddScoped<IPaymentOutService, PaymentOutService>();
// Purchase Invoice
builder.Services.AddScoped<IPurchaseInvoiceRepository, PurchaseInvoiceRepository>();
builder.Services.AddScoped<IPurchaseInvoiceService, PurchaseInvoiceService>();
// Customer Deposit
builder.Services.AddScoped<ICustomerDepositRepository, CustomerDepositRepository>();
builder.Services.AddScoped<ICustomerDepositService, CustomerDepositService>();
// Debt
builder.Services.AddScoped<IDebtRepository, DebtRepository>();
builder.Services.AddScoped<IDebtService, DebtService>();
// Expense
builder.Services.AddScoped<IExpenseRepository, ExpenseRepository>();
builder.Services.AddScoped<IExpenseService, ExpenseService>();
// Consignment
builder.Services.AddScoped<IConsignmentRepository, ConsignmentRepository>();
builder.Services.AddScoped<IConsignmentService, ConsignmentService>();
// POS
builder.Services.AddScoped<IPosService, PosService>();
// Store Profile
builder.Services.AddScoped<IStoreProfileService, StoreProfileService>();
// Profit & Loss
builder.Services.AddScoped<IProfitLossService, ProfitLossService>();
// Price History
builder.Services.AddScoped<IPriceHistoryService, PriceHistoryService>();
// Notification / Alert Center
builder.Services.AddScoped<INotificationService, NotificationService>();
// Customer Statement
builder.Services.AddScoped<ICustomerStatementService, CustomerStatementService>();
// Promo
builder.Services.AddScoped<IPromoService, PromoService>();
// Customer Aging
builder.Services.AddScoped<ICustomerAgingService, CustomerAgingService>();
builder.Services.AddSingleton<IHttpContextAccessor, HttpContextAccessor>();
builder.Services.AddScoped<API.Services.IAuditService, API.Services.AuditService>();
builder.Services.AddScoped<API.Services.IStockLedgerService, API.Services.StockLedgerService>();
// Midtrans QRIS
builder.Services.Configure<API.Services.MidtransSettings>(builder.Configuration.GetSection("Midtrans"));
builder.Services.AddHttpClient("Midtrans");
builder.Services.AddScoped<API.Services.Interfaces.IMidtransService, API.Services.MidtransService>();
builder.Services.AddScoped<MKSSPContextProcedures>();
builder.Services.AddDbContextPool<MKSTableContext>(options =>
{
    options.UseSqlServer(builder.Configuration.GetConnectionString("MKS"));
}, poolSize: 32);
builder.Services.AddDbContext<MKSSPContext>(options =>
{
    options.UseSqlServer(builder.Configuration.GetConnectionString("MKS"));
});

builder.Services.AddAuthorization(options =>
{
    options.DefaultPolicy = new AuthorizationPolicyBuilder()
        .AddAuthenticationSchemes("AuthScheme")
        .RequireAuthenticatedUser()
        .Build();
});

// Add in-memory cache for small reference data
builder.Services.AddMemoryCache();
var app = builder.Build();

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    // The default HSTS value is 30 days. You may want to change this for production scenarios, see https://aka.ms/aspnetcore-hsts.
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();

app.UseRouting();
app.UseAuthentication();
app.UseMiddleware<PermissionSyncMiddleware>();
app.UseAuthorization();
app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");

app.Run();
