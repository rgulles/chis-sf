const fs = require("fs");
const file = "c:/Users/PC/Desktop/San-Fernando/backend/routes/api.php";
let code = fs.readFileSync(file, "utf8");

// Add import
code = code.replace(
  "use App\\Http\\Controllers\\HeritageSiteController;",
  "use App\\Http\\Controllers\\HeritageSiteController;\nuse App\\Http\\Controllers\\DashboardController;"
);

// Add route inside admin group
code = code.replace(
  /Route::middleware\(\['auth:sanctum', 'can:admin'\]\)->group\(function \(\) \{/,
  `Route::middleware(['auth:sanctum', 'can:admin'])->group(function () {\n    Route::get('/admin/dashboard', [DashboardController::class, 'index']);`
);

fs.writeFileSync(file, code);
