const fs = require("fs");
const file = "c:/Users/PC/Desktop/San-Fernando/frontend/src/views/AdminPhotoManagement.tsx";
let code = fs.readFileSync(file, "utf8");

code = code.replace("../utils/storage", "../utils/adminData");
code = code.replace("Plus, Image as ImageIcon, Star, Edit3, Trash2, CheckCircle, UploadCloud, X", "Image as ImageIcon, Star, Edit3, Trash2, UploadCloud, X");

// Just replace `addToast(A, B)` with `addToast(B, A)` using regex group
code = code.replace(/addToast\((.*?), (\"success\"|\"error\"|\"warning\"|\"info\")\)/g, "addToast($2, $1)");

code = code.replace("const coverImage = images.find(img => img.is_cover) || images[0];", "");

fs.writeFileSync(file, code);
