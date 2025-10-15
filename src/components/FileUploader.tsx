import { useCallback } from "react";
import { Upload, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface FileUploaderProps {
  onFilesSelected: (files: File[]) => void;
  isProcessing: boolean;
}

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB (Google Vision API limit)
const MAX_FILES = 16; // Google Vision API limit

export const FileUploader = ({ onFilesSelected, isProcessing }: FileUploaderProps) => {
  const { toast } = useToast();

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();

      if (isProcessing) {
        toast({
          title: "Processing in progress",
          description: "Please wait for current files to finish processing",
          variant: "destructive",
        });
        return;
      }

      const files = Array.from(e.dataTransfer.files).filter(
        (file) =>
          file.type === "application/pdf" ||
          file.type.startsWith("image/")
      );

      if (files.length === 0) {
        toast({
          title: "Invalid files",
          description: "Please upload PDF or image files only",
          variant: "destructive",
        });
        return;
      }

      // Check file sizes
      const oversizedFiles = files.filter(file => file.size > MAX_FILE_SIZE);
      if (oversizedFiles.length > 0) {
        toast({
          title: "File too large",
          description: `Maximum file size is 20MB (Google Vision API limit). ${oversizedFiles[0].name} is ${(oversizedFiles[0].size / 1024 / 1024).toFixed(2)}MB`,
          variant: "destructive",
        });
        return;
      }

      if (files.length > MAX_FILES) {
        toast({
          title: "Too many files",
          description: `Maximum ${MAX_FILES} files allowed at once (Google Vision API limit)`,
          variant: "destructive",
        });
        return;
      }

      onFilesSelected(files);
    },
    [isProcessing, onFilesSelected, toast]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (isProcessing) {
        toast({
          title: "Processing in progress",
          description: "Please wait for current files to finish processing",
          variant: "destructive",
        });
        return;
      }

      const files = Array.from(e.target.files || []);
      
      // Check file sizes
      const oversizedFiles = files.filter(file => file.size > MAX_FILE_SIZE);
      if (oversizedFiles.length > 0) {
        toast({
          title: "File too large",
          description: `Maximum file size is 20MB (Google Vision API limit). ${oversizedFiles[0].name} is ${(oversizedFiles[0].size / 1024 / 1024).toFixed(2)}MB`,
          variant: "destructive",
        });
        e.target.value = "";
        return;
      }
      
      if (files.length > MAX_FILES) {
        toast({
          title: "Too many files",
          description: `Maximum ${MAX_FILES} files allowed at once (Google Vision API limit)`,
          variant: "destructive",
        });
        return;
      }

      onFilesSelected(files);
      e.target.value = "";
    },
    [isProcessing, onFilesSelected, toast]
  );

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      className="border-2 border-dashed border-border rounded-lg p-12 text-center hover:border-primary transition-colors"
    >
      <div className="flex flex-col items-center gap-4">
        <div className="rounded-full bg-primary/10 p-4">
          <Upload className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold mb-2">Upload Documents</h3>
          <p className="text-muted-foreground mb-4">
            Drag & drop PDF or image files here, or click to browse
          </p>
          <label htmlFor="file-upload" className="cursor-pointer">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity">
              <FileText className="h-4 w-4" />
              Select Files
            </div>
            <input
              id="file-upload"
              type="file"
              multiple
              accept=".pdf,image/*"
              onChange={handleFileInput}
              className="hidden"
              disabled={isProcessing}
            />
          </label>
          <p className="text-xs text-muted-foreground mt-2">
            Maximum 16 files • PDF or Images only • Max 20MB per file
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Powered by Google Vision API
          </p>
        </div>
      </div>
    </div>
  );
};
