using API.Context.SP;
using API.Context.Table;
using API.Repository;
using API.Repository.Interfaces;
using API.Services;
using API.Services.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllersWithViews();

// Database
builder.Services.AddDbContextPool<MKSTableContext>(options =>
{
    options.UseSqlServer(builder.Configuration.GetConnectionString("MKS"));
}, poolSize: 32);
builder.Services.AddDbContext<MKSSPContext>(options =>
{
    options.UseSqlServer(builder.Configuration.GetConnectionString("MKS"));
});
builder.Services.AddScoped<MKSSPContextProcedures>();

// Shared services from API project
builder.Services.AddSingleton<IHttpContextAccessor, HttpContextAccessor>();
// Catalog
builder.Services.AddScoped<ICatalogRepository, CatalogRepository>();
builder.Services.AddScoped<ICatalogService, CatalogService>();
// Store Profile
builder.Services.AddScoped<IStoreProfileService, StoreProfileService>();
// Marketplace Auth
builder.Services.AddScoped<IMarketplaceAuthRepository, MarketplaceAuthRepository>();
builder.Services.AddScoped<IMarketplaceAuthService, MarketplaceAuthService>();
// Marketplace Orders
builder.Services.AddScoped<IMarketplaceOrderRepository, MarketplaceOrderRepository>();
builder.Services.AddScoped<IMarketplaceOrderService, MarketplaceOrderService>();
builder.Services.AddScoped<API.Services.IStockLedgerService, API.Services.StockLedgerService>();
// Midtrans QRIS
builder.Services.Configure<MidtransSettings>(builder.Configuration.GetSection("Midtrans"));
builder.Services.AddHttpClient("Midtrans");
builder.Services.AddScoped<IMidtransService, MidtransService>();

// Authentication (separate from backoffice)
builder.Services.AddAuthentication("MarketplaceAuth").AddCookie("MarketplaceAuth", options =>
{
    options.LoginPath = "/Account/Login";
    options.LogoutPath = "/Account/Logout";
    options.Cookie.Name = "Marketplace.Auth";
});

builder.Services.AddMemoryCache();
builder.Services.AddSession(options =>
{
    options.IdleTimeout = TimeSpan.FromMinutes(60);
    options.Cookie.HttpOnly = true;
    options.Cookie.IsEssential = true;
});

var app = builder.Build();

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();

var sharedUploadsPath = Path.GetFullPath(Path.Combine(app.Environment.ContentRootPath, "..", "Uploads"));
Directory.CreateDirectory(sharedUploadsPath);
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(sharedUploadsPath),
    RequestPath = "/uploads"
});

app.UseRouting();
app.UseSession();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");

app.Run();
