import { ProcessedDocument } from "@/types/document";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { FileText, Download, Loader2, CheckCircle2, AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DocumentResultsProps {
  documents: ProcessedDocument[];
  onDelete: (index: number) => void;
}

export const DocumentResults = ({ documents, onDelete }: DocumentResultsProps) => {
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
              className="border rounded-lg p-4 space-y-3 hover:bg-muted/50 transition-colors relative"
            >
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 h-8 w-8"
                onClick={() => onDelete(index)}
                title="Remove document"
              >
                <X className="h-4 w-4" />
              </Button>

              <div className="flex items-start justify-between gap-4 pr-10">
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

                      <div className="ml-4 mt-2 text-sm border-l-2 border-muted pl-3 space-y-2">
                        {doc.validationStatus && (
                          <Badge variant={doc.validationStatus === 'PASSED' ? 'default' : 'destructive'}>
                            {doc.validationStatus}
                          </Badge>
                        )}
                        {doc.textQuality && (
                          <Badge variant="outline" className={
                            doc.textQuality === 'good' ? 'border-success' :
                            doc.textQuality === 'fair' ? 'border-warning' : 'border-destructive'
                          }>
                            {doc.textQuality} quality
                          </Badge>
                        )}

                        {doc.secondaryType && doc.secondaryConfidence && doc.secondaryConfidence > 15 && (
                          <div className="text-xs text-muted-foreground">
                            Secondary: {doc.secondaryType} ({doc.secondaryConfidence.toFixed(1)}%)
                          </div>
                        )}

                        {doc.exclusionKeywordsFound && doc.exclusionKeywordsFound.length > 0 && (
                          <div className="text-xs text-destructive">
                            ⚠️ Exclusion keywords: {doc.exclusionKeywordsFound.join(', ')}
                          </div>
                        )}

                        {doc.validationPenaltiesApplied && doc.validationPenaltiesApplied.length > 0 && (
                          <div className="text-xs text-warning">
                            <div className="font-medium">Penalties:</div>
                            <ul className="list-disc list-inside">
                              {doc.validationPenaltiesApplied.map((penalty, pIdx) => (
                                <li key={pIdx}>{penalty}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {doc.ambiguityWarning && (
                          <div className="text-xs text-warning font-medium">
                            ⚠️ {doc.ambiguityWarning}
                          </div>
                        )}

                        {doc.mandatoryFieldsStatus && (
                          <div className="text-xs">
                            <span className="font-medium">Mandatory Fields:</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {Object.entries(doc.mandatoryFieldsStatus).map(([field, status]) => (
                                <Badge 
                                  key={field} 
                                  variant={status === 'present' ? 'default' : 'destructive'}
                                  className="text-xs"
                                >
                                  {field}: {status}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {doc.keywordsDetected && doc.keywordsDetected.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {doc.keywordsDetected.map((kw, kwIdx) => (
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
                                {kw.position && ` [${kw.position}]`}
                                {kw.occurrences && kw.occurrences > 1 && ` x${kw.occurrences_capped || kw.occurrences}`}
                              </Badge>
                            ))}
                          </div>
                        )}

                        {doc.uniqueKeywordsCount !== undefined && (
                          <div className="text-xs text-muted-foreground">
                            Unique keywords: {doc.uniqueKeywordsCount}
                          </div>
                        )}
                      </div>
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
