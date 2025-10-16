import { ProcessedDocument } from "@/types/document";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { FileText, Download, Loader2, CheckCircle2, AlertCircle, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState } from "react";

interface DocumentResultsProps {
  documents: ProcessedDocument[];
  onDelete: (index: number) => void;
}

export const DocumentResults = ({ documents, onDelete }: DocumentResultsProps) => {
  const [openDetails, setOpenDetails] = useState<Record<number, boolean>>({});
  
  if (documents.length === 0) return null;

  const toggleDetails = (index: number) => {
    setOpenDetails(prev => ({ ...prev, [index]: !prev[index] }));
  };

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

                      <Collapsible open={openDetails[index]} onOpenChange={() => toggleDetails(index)}>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="w-full justify-start gap-2 mb-2">
                            <ChevronDown className={`h-4 w-4 transition-transform ${openDetails[index] ? 'transform rotate-180' : ''}`} />
                            <span className="text-sm">View Classification Details</span>
                          </Button>
                        </CollapsibleTrigger>
                        
                        <CollapsibleContent>
                          <div className="ml-4 mt-2 text-sm border-l-2 border-muted pl-3 space-y-3">
                            {doc.validationStatus && (
                              <div className="space-y-1">
                                <Badge variant={doc.validationStatus === 'PASSED' ? 'default' : 'destructive'}>
                                  Validation: {doc.validationStatus}
                                </Badge>
                                <p className="text-xs text-muted-foreground">
                                  {doc.validationStatus === 'PASSED' 
                                    ? 'All required document criteria met' 
                                    : 'Missing required fields or criteria'}
                                </p>
                              </div>
                            )}
                            
                            {doc.textQuality && (
                              <div className="space-y-1">
                                <Badge variant="outline" className={
                                  doc.textQuality === 'good' ? 'border-success' :
                                  doc.textQuality === 'fair' ? 'border-warning' : 'border-destructive'
                                }>
                                  OCR Quality: {doc.textQuality === 'good' ? 'Excellent' : doc.textQuality === 'fair' ? 'Fair' : 'Poor'}
                                </Badge>
                                <p className="text-xs text-muted-foreground">
                                  {doc.textQuality === 'good' && 'Text extracted clearly with high confidence'}
                                  {doc.textQuality === 'fair' && 'Some text may be unclear or require verification'}
                                  {doc.textQuality === 'poor' && 'Text extraction had difficulties, manual review recommended'}
                                </p>
                              </div>
                            )}

                            {doc.keywordsDetected && doc.keywordsDetected.length > 0 && (
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-semibold">Keywords Found in Document ({doc.keywordsDetected.length})</span>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  (+weight) indicates keyword strength, [position] shows where found, x# shows occurrences
                                </p>
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
                                {doc.uniqueKeywordsCount !== undefined && (
                                  <div className="text-xs text-muted-foreground">
                                    Unique keywords detected: {doc.uniqueKeywordsCount}
                                  </div>
                                )}
                              </div>
                            )}

                            {doc.mandatoryFieldsStatus && (
                              <div className="text-xs space-y-1">
                                <span className="font-semibold">Mandatory Fields:</span>
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

                            {doc.secondaryType && doc.secondaryConfidence && doc.secondaryConfidence > 15 && (
                              <div className="text-xs text-muted-foreground">
                                <span className="font-semibold">Secondary Type:</span> {doc.secondaryType} ({doc.secondaryConfidence.toFixed(1)}%)
                              </div>
                            )}

                            {doc.exclusionKeywordsFound && doc.exclusionKeywordsFound.length > 0 && (
                              <div className="text-xs text-destructive space-y-1">
                                <div className="font-semibold">⚠️ Exclusion Keywords Detected:</div>
                                <div>{doc.exclusionKeywordsFound.join(', ')}</div>
                                <p className="text-xs">These keywords suggest this might not be a {doc.finalType}</p>
                              </div>
                            )}

                            {doc.validationPenaltiesApplied && doc.validationPenaltiesApplied.length > 0 && (
                              <div className="text-sm space-y-2 p-3 bg-warning/10 border border-warning/30 rounded">
                                <div className="font-semibold text-warning flex items-center gap-2">
                                  <AlertCircle className="h-4 w-4" />
                                  Classification Issues Detected
                                </div>
                                <p className="text-xs text-muted-foreground mb-2">
                                  The following issues were found that reduced confidence or affected the final classification:
                                </p>
                                <div className="space-y-2">
                                  {doc.validationPenaltiesApplied.map((penalty, pIdx) => (
                                    <div key={pIdx} className="bg-background/50 p-2 rounded border-l-2 border-warning flex gap-2">
                                      <AlertCircle className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
                                      <div className="text-xs text-muted-foreground leading-relaxed">{penalty}</div>
                                    </div>
                                  ))}
                                </div>
                                <p className="text-xs text-muted-foreground italic mt-2">
                                  💡 Each issue above explains why it reduced the confidence score for this document type
                                </p>
                              </div>
                            )}

                            {doc.ambiguityWarning && (
                              <div className="text-xs text-warning space-y-1">
                                <div className="font-semibold">⚠️ Ambiguity Warning</div>
                                <div>{doc.ambiguityWarning}</div>
                              </div>
                            )}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
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
