import React, { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, Image as ImageIcon, Star, Edit3, Trash2, UploadCloud, X } from "lucide-react";
import { useToast } from "../hooks/useToast";
import { useConfirm } from "../hooks/useConfirm";
import { apiCreateSiteImage, apiUpdateSiteImage, apiDeleteSiteImage } from "../api/client";
import { storageImageUrl } from "../utils/adminData";

interface AdminPhotoManagementProps {
  site: any;
  siteImages: any[];
  onBack: () => void;
  onRefresh: () => void;
}

export function AdminPhotoManagement({ site, siteImages, onBack, onRefresh }: AdminPhotoManagementProps) {
  const { addToast } = useToast();
  const { confirm } = useConfirm();
  const [uploading, setUploading] = useState(false);
  const [editingImage, setEditingImage] = useState<any>(null);
  const [editCaption, setEditCaption] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const images = siteImages.filter((img) => img.heritage_site_id === site.id).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
    const maxBytes = 5 * 1024 * 1024;
    const validFiles: File[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!validTypes.includes(file.type)) {
        addToast("error", `Skipped ${file.name} (unsupported format)`);
        continue;
      }
      if (file.size > maxBytes) {
        addToast("error", `Skipped ${file.name} (exceeds 5MB)`);
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) return;

    setUploading(true);
    let successCount = 0;
    let failCount = 0;

    for (const file of validFiles) {
      try {
        await apiCreateSiteImage({
          heritage_site_id: site.id,
          imageFile: file,
          caption: "",
          is_cover: false,
          sort_order: images.length + successCount,
        });
        successCount++;
      } catch (err) {
        console.error("Upload failed for", file.name, err);
        failCount++;
      }
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";

    if (successCount > 0) {
      addToast("success", `Successfully uploaded ${successCount} photo(s).`);
      onRefresh();
    }
    if (failCount > 0) {
      addToast("error", `Failed to upload ${failCount} photo(s).`);
    }
  };

  const handleSetCover = async (img: any) => {
    try {
      await apiUpdateSiteImage(String(img.id), {
        heritage_site_id: site.id,
        is_cover: true,
      });
      addToast("success", "Cover photo updated.");
      onRefresh();
    } catch (err) {
      addToast("error", "Failed to update cover photo.");
    }
  };

  const handleDelete = (img: any) => {
    confirm({
      title: "Delete Photo",
      message: "Are you sure you want to delete this photo? This action cannot be undone.",
      confirmText: "Delete",
      onConfirm: async () => {
        try {
          await apiDeleteSiteImage(String(img.id));
          addToast("success", "Photo deleted successfully.");
          onRefresh();
        } catch (err) {
          addToast("error", "Failed to delete photo.");
        }
      }
    });
  };

  const handleSaveEdit = async () => {
    if (!editingImage) return;
    try {
      await apiUpdateSiteImage(String(editingImage.id), {
        heritage_site_id: site.id,
        caption: editCaption.trim() || null,
      });
      addToast("success", "Caption updated.");
      setEditingImage(null);
      onRefresh();
    } catch (err) {
      addToast("error", "Failed to update caption.");
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-slide-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-[#7A1C30] transition-colors mb-2">
            <ArrowLeft className="w-4 h-4" /> Back to Heritage Sites
          </button>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 font-serif tracking-tight">Photo Management</h1>
          <p className="text-sm text-gray-600 font-medium flex items-center gap-2 mt-1">
            <span className="font-bold text-gray-900">{site.name}</span>
            <span className="w-1 h-1 rounded-full bg-gray-300"></span>
            <span>{site.category || "Unspecified"}</span>
            <span className="w-1 h-1 rounded-full bg-gray-300"></span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider ${site.status === "active" ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-800"}`}>
              {site.status}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" ref={fileInputRef} onChange={handleFilesSelected} />
          <button
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#7A1C30] hover:bg-[#581020] text-white font-bold rounded-xl transition-colors shadow-md cursor-pointer disabled:opacity-50"
          >
            {uploading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <UploadCloud className="w-4 h-4" />}
            {uploading ? "Uploading..." : "Add Photos"}
          </button>
        </div>
      </div>

      {images.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {images.map(img => (
            <div key={img.id} className={`group relative bg-white rounded-2xl shadow-sm border ${img.is_cover ? "border-[#7A1C30] ring-1 ring-[#7A1C30]" : "border-[#e8dfd5]"} overflow-hidden transition-all hover:shadow-md`}>
              <div className="aspect-[4/3] w-full overflow-hidden bg-gray-100 relative">
                <img src={storageImageUrl(img.image_url || img.image_path)} alt={img.caption || site.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                
                {img.is_cover && (
                  <div className="absolute top-3 left-3 bg-[#7A1C30] text-white text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full shadow-md flex items-center gap-1">
                    <Star className="w-3 h-3 fill-current" /> Cover Photo
                  </div>
                )}
                
                <div className="absolute bottom-3 left-0 right-0 px-3 flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0">
                  {!img.is_cover && (
                    <button onClick={() => handleSetCover(img)} className="p-2 bg-white/90 hover:bg-white text-gray-700 hover:text-[#7A1C30] rounded-lg backdrop-blur-sm transition-colors shadow-sm" title="Set as Cover Photo">
                      <Star className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={() => { setEditingImage(img); setEditCaption(img.caption || ""); }} className="p-2 bg-white/90 hover:bg-white text-blue-600 rounded-lg backdrop-blur-sm transition-colors shadow-sm" title="Edit Caption">
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(img)} className="p-2 bg-white/90 hover:bg-white text-red-600 rounded-lg backdrop-blur-sm transition-colors shadow-sm" title="Delete Photo">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="p-4">
                <p className="text-sm font-medium text-gray-900 truncate" title={img.caption || "No caption"}>{img.caption || <span className="text-gray-400 italic">No caption</span>}</p>
                <p className="text-xs text-gray-500 mt-1">Added {img.created_at ? new Date(img.created_at).toLocaleDateString() : "recently"}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-white border border-[#e8dfd5] border-dashed rounded-2xl">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-50 mb-4">
            <ImageIcon className="w-8 h-8 text-gray-300" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">No photos yet</h3>
          <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">Upload photos to showcase this heritage site. You can select multiple images at once.</p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-[#e8dfd5] hover:bg-gray-50 text-gray-700 font-bold rounded-xl transition-colors shadow-sm cursor-pointer"
          >
            <UploadCloud className="w-4 h-4 text-[#7A1C30]" /> Add First Photos
          </button>
        </div>
      )}

      {/* Edit Caption Modal */}
      {editingImage && createPortal(
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 rounded-t-2xl shrink-0">
              <h2 className="text-lg font-bold text-gray-900">Edit Photo Details</h2>
              <button onClick={() => setEditingImage(null)} className="text-gray-400 hover:text-gray-700 bg-white rounded-full p-1.5 border border-[#e8dfd5] transition-colors"><X className="w-4 h-4"/></button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto">
              <div className="flex justify-center items-center w-full max-h-72 min-h-48 rounded-xl overflow-hidden bg-gray-100 border border-[#e8dfd5]">
                <img src={storageImageUrl(editingImage.image_url || editingImage.image_path)} alt="Preview" className="max-w-full max-h-72 object-contain" />
              </div>
              <div className="space-y-1.5">
                <label className="ui-label font-semibold text-gray-700">Caption</label>
                <input 
                  type="text" 
                  autoFocus
                  className="w-full border border-[#e8dfd5] rounded-xl p-2.5 focus:ring-0 focus:border-[#7A1C30] focus:border-2 transition-all outline-none" 
                  value={editCaption} 
                  onChange={(e) => setEditCaption(e.target.value)} 
                  placeholder="e.g. Front facade during sunset"
                  onKeyDown={(e) => e.key === "Enter" && handleSaveEdit()}
                />
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50 rounded-b-2xl shrink-0">
              <button onClick={() => setEditingImage(null)} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors">Cancel</button>
              <button onClick={handleSaveEdit} className="px-5 py-2 bg-[#7A1C30] hover:bg-[#581020] text-white text-sm font-bold rounded-xl transition-colors shadow-md">Save Changes</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
