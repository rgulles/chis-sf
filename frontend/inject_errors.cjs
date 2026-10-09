const fs = require("fs");
const file = "c:/Users/PC/Desktop/San-Fernando/frontend/src/views/AdminView.tsx";
let code = fs.readFileSync(file, "utf8");

// 1. Add `name="..."` to fields using their `value={formName.fieldName...}`
code = code.replace(/value=\{([a-zA-Z]+Form)\.([a-zA-Z0-9_]+)(\s*\|\|[^\}]+)?\}/g, (match, form, field, fallback) => {
  return `name="${field}" ${match}`;
});

// Also fix image files where there is no value but we have a label or input
// Actually, if an image fails, we might just show it at the top. The user mainly cares about text fields.

// 2. Add the global useEffect inside AdminView
const useEffectCode = `
  useEffect(() => {
    // Clear old errors
    document.querySelectorAll(".inline-error-msg").forEach(e => e.remove());
    document.querySelectorAll(".error-field-highlight").forEach(e => {
      e.classList.remove("error-field-highlight", "border-red-500", "bg-red-50", "text-red-900");
      e.classList.add("border-[#e8dfd5]");
    });

    Object.entries(formErrors).forEach(([formType, err]) => {
      const formEl = document.getElementById(\`admin-\${formType}-form\`);
      if (!formEl || !err || !err.validationErrors) return;

      Object.entries(err.validationErrors).forEach(([field, messages]) => {
        // Some backend fields might map to different frontend names, but mostly they match
        const inputEl = formEl.querySelector(\`[name="\${field}"]\`);
        if (inputEl) {
          inputEl.classList.add("error-field-highlight", "border-red-500", "bg-red-50", "text-red-900");
          inputEl.classList.remove("border-[#e8dfd5]");
          
          const errorText = document.createElement("p");
          errorText.className = "inline-error-msg text-xs font-semibold text-red-600 mt-1.5 animate-fade-slide-in";
          errorText.innerText = messages.join(", ");
          
          // Append to parent, or if parent is a flex row (like opening hours), append to grandparent
          let container = inputEl.parentElement;
          if (container && container.classList.contains("flex") && container.classList.contains("items-center")) {
             container = container.parentElement;
          }
          container?.appendChild(errorText);
        }
      });
    });
  }, [formErrors]);
`;

code = code.replace(
  /const \{ addToast \} = useToast\(\);/,
  `const { addToast } = useToast();\n${useEffectCode}`
);

fs.writeFileSync(file, code);
