import { ProcessedDocument } from "@/types/document";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { FileText, Download, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DocumentResultsProps {
  documents: ProcessedDocument[];
}

export const DocumentResults = ({ documents }: DocumentResultsProps) => {
  if (documents.length === 0) return null;

  const getStatusIcon = (status: ProcessedDocument["status"]) => {
    switch (status) {
      case "finished":
        return <CheckCircle2 className="h-4 w-4 text-success" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 70) return "text-success";
    if (confidence >= 40) return "text-warning";
    return "text-destructive";
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 70) return "bg-success";
    if (confidence >= 40) return "bg-warning";
    return "bg-destructive";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Processing Results
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {documents.map((doc, index) => (
            <div
              key={index}
              className="border rounded-lg p-4 space-y-3 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    {getStatusIcon(doc.status)}
                    <h4 className="font-semibold truncate">{doc.fileName}</h4>
                  </div>
                  
                  {doc.status === "finished" && (
                    <>
                      <div className="flex items-center gap-4 mb-2">
                        <div>
                          <span className="text-sm text-muted-foreground">Type: </span>
                          <Badge variant="default" className="ml-1">
                            {doc.finalType}
                          </Badge>
                        </div>
                        <div>
                          <span className="text-sm text-muted-foreground">Confidence: </span>
                          <span className={`font-semibold ${getConfidenceColor(doc.finalConfidence)}`}>
                            {doc.finalConfidence.toFixed(1)}%
                          </span>
                        </div>
                      </div>

                      <Progress 
                        value={doc.finalConfidence} 
                        className="h-2 mb-3"
                      />

                      {doc.chunks.map((chunk, chunkIdx) => (
                        <div key={chunkIdx} className="ml-4 mt-2 text-sm border-l-2 border-muted pl-3">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-muted-foreground">
                              Chunk {chunk.chunkIndex} ({chunk.pageCount} pages):
                            </span>
                            <Badge variant="outline" className={getConfidenceBadge(chunk.confidencePercentage)}>
                              {chunk.probableType} - {chunk.confidencePercentage.toFixed(1)}%
                            </Badge>
                          </div>
                          {chunk.keywordsDetected.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {chunk.keywordsDetected.map((kw, kwIdx) => (
                                <Badge
                                  key={kwIdx}
                                  variant="secondary"
                                  className={
                                    kw.type === "strong"
                                      ? "bg-success/20"
                                      : kw.type === "moderate"
                                      ? "bg-warning/20"
                                      : "bg-secondary"
                                  }
                                >
                                  {kw.keyword} (+{kw.weight})
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </>
                  )}

                  {doc.status === "error" && (
                    <p className="text-sm text-destructive">{doc.error}</p>
                  )}

                  {(doc.status === "uploading" || doc.status === "ocr" || doc.status === "classifying") && (
                    <p className="text-sm text-muted-foreground">
                      {doc.status === "uploading" && "Uploading..."}
                      {doc.status === "ocr" && "Extracting text with OCR..."}
                      {doc.status === "classifying" && "Classifying document..."}
                    </p>
                  )}
                </div>

                {doc.status === "finished" && (
                  <Button size="sm" variant="outline">
                    <Download className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
