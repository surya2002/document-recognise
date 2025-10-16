import { useState, useEffect } from "react";
import { KEYWORD_MATRIX, KeywordWithMultipliers } from "@/types/document";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Edit, Plus, X, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const KeywordMatrix = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editedMatrix, setEditedMatrix] = useState(KEYWORD_MATRIX);
  const [newDocType, setNewDocType] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadKeywordMatrix();
  }, []);

  const loadKeywordMatrix = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('keyword_matrix')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;

      if (data && data.length > 0) {
        const loadedMatrix: any = {};
        data.forEach(row => {
          loadedMatrix[row.doc_type] = {
            strong: row.strong_keywords || [],
            moderate: row.moderate_keywords || [],
            weak: row.weak_keywords || [],
            exclusion: row.exclusion_keywords || [],
            exclusionPenalty: row.exclusion_penalty_percentage || 50,
            mandatory: row.mandatory_fields || {},
            regional: row.regional_keywords || {}
          };
        });
        setEditedMatrix(loadedMatrix);
      }
    } catch (error) {
      console.error('Error loading keyword matrix:', error);
    }
  };

  const handleKeywordChange = (
    docType: keyof typeof KEYWORD_MATRIX,
    level: 'strong' | 'moderate' | 'weak',
    index: number,
    field: 'keyword' | 'headerMult' | 'bodyMult' | 'footerMult',
    value: string | number
  ) => {
    setEditedMatrix(prev => ({
      ...prev,
      [docType]: {
        ...prev[docType],
        [level]: prev[docType][level].map((kw, i) => 
          i === index ? { ...kw, [field]: value } : kw
        )
      }
    }));
  };

  const handleAddKeyword = (docType: keyof typeof KEYWORD_MATRIX, level: 'strong' | 'moderate' | 'weak') => {
    const newKeyword: KeywordWithMultipliers = {
      keyword: '',
      headerMult: 1.2,
      bodyMult: 1.0,
      footerMult: 0.8
    };
    setEditedMatrix(prev => ({
      ...prev,
      [docType]: {
        ...prev[docType],
        [level]: [...prev[docType][level], newKeyword]
      }
    }));
  };

  const handleRemoveKeyword = (docType: keyof typeof KEYWORD_MATRIX, level: 'strong' | 'moderate' | 'weak', index: number) => {
    setEditedMatrix(prev => ({
      ...prev,
      [docType]: {
        ...prev[docType],
        [level]: prev[docType][level].filter((_, i) => i !== index)
      }
    }));
  };

  const handleAddDocType = () => {
    if (!newDocType.trim()) return;
    
    setEditedMatrix(prev => ({
      ...prev,
      [newDocType]: {
        strong: [],
        moderate: [],
        weak: [],
        exclusion: [],
        exclusionPenalty: 50,
        mandatory: {},
        regional: {}
      }
    }));
    setNewDocType("");
  };

  const handleRemoveDocType = (docType: string) => {
    setEditedMatrix(prev => {
      const newMatrix = { ...prev };
      delete newMatrix[docType];
      return newMatrix;
    });
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be logged in to save keyword matrix");
        return;
      }

      // Clean up and validate data
      const cleanedMatrix = Object.fromEntries(
        Object.entries(editedMatrix).map(([docType, keywords]) => [
          docType,
          {
            strong: keywords.strong.filter((kw: KeywordWithMultipliers) => kw.keyword.trim() !== ''),
            moderate: keywords.moderate.filter((kw: KeywordWithMultipliers) => kw.keyword.trim() !== ''),
            weak: keywords.weak.filter((kw: KeywordWithMultipliers) => kw.keyword.trim() !== ''),
            exclusion: (keywords.exclusion || []).filter(kw => kw.trim() !== ''),
            exclusionPenalty: keywords.exclusionPenalty || 50,
            mandatory: keywords.mandatory || {},
            regional: keywords.regional || {}
          }
        ])
      ) as any;

      // Delete existing data
      await supabase
        .from('keyword_matrix')
        .delete()
        .eq('user_id', user.id);

      // Insert new data
      const insertData = Object.entries(cleanedMatrix).map(([docType, keywords]: [string, any]) => ({
        user_id: user.id,
        doc_type: docType,
        strong_keywords: keywords.strong,
        moderate_keywords: keywords.moderate,
        weak_keywords: keywords.weak,
        exclusion_keywords: keywords.exclusion || [],
        exclusion_penalty_percentage: keywords.exclusionPenalty || 50,
        mandatory_fields: keywords.mandatory || {},
        regional_keywords: keywords.regional || {}
      }));

      const { error } = await supabase
        .from('keyword_matrix')
        .insert(insertData);

      if (error) throw error;

      // Update in-memory matrix
      Object.assign(KEYWORD_MATRIX, cleanedMatrix);
      
      toast.success("Keyword matrix saved successfully");
      setIsEditOpen(false);
    } catch (error) {
      console.error('Error saving keyword matrix:', error);
      toast.error("Failed to save keyword matrix");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            Weighted Keyword Matrix
            {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </CardTitle>
          <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
            <DialogTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="outline" size="sm">
                <Edit className="h-4 w-4 mr-2" />
                Edit Matrix
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Keyword Matrix</DialogTitle>
                <DialogDescription>
                  Customize keywords and their position multipliers. Each keyword can have different weights in header, body, and footer regions.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-6">
                {/* Add New Document Type */}
                <div className="border-b pb-4">
                  <Label className="text-base font-semibold mb-2 block">Add New Document Type</Label>
                  <div className="flex gap-2">
                    <Input
                      value={newDocType}
                      onChange={(e) => setNewDocType(e.target.value)}
                      placeholder="Enter document type name..."
                      onKeyDown={(e) => e.key === 'Enter' && handleAddDocType()}
                    />
                    <Button onClick={handleAddDocType} disabled={!newDocType.trim()}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add Type
                    </Button>
                  </div>
                </div>
                {Object.entries(editedMatrix).map(([docType, keywords]) => (
                  <div key={docType} className="space-y-3 border-b pb-4 last:border-b-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-lg">{docType}</h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveDocType(docType)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Remove Type
                      </Button>
                    </div>
                    <div className="grid gap-4">
                      {/* Strong Indicators */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <Label className="text-success">Strong Indicators (+3)</Label>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleAddKeyword(docType as keyof typeof KEYWORD_MATRIX, 'strong')}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Add
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {/* Column Headers */}
                          <div className="grid grid-cols-[1fr_80px_80px_80px_40px] gap-2 text-xs text-muted-foreground font-medium px-2">
                            <div>Keyword</div>
                            <div>Header</div>
                            <div>Body</div>
                            <div>Footer</div>
                            <div></div>
                          </div>
                          {keywords.strong.map((kw, idx) => (
                            <div key={idx} className="grid grid-cols-[1fr_80px_80px_80px_40px] gap-2">
                              <Input
                                value={kw.keyword}
                                onChange={(e) => handleKeywordChange(docType as keyof typeof KEYWORD_MATRIX, 'strong', idx, 'keyword', e.target.value)}
                                placeholder="Keyword..."
                              />
                              <Input
                                type="number"
                                step="0.1"
                                min="0"
                                max="3"
                                value={kw.headerMult}
                                onChange={(e) => handleKeywordChange(docType as keyof typeof KEYWORD_MATRIX, 'strong', idx, 'headerMult', parseFloat(e.target.value) || 1.2)}
                                className={kw.headerMult > 1 ? 'border-green-500' : kw.headerMult < 1 ? 'border-red-500' : ''}
                              />
                              <Input
                                type="number"
                                step="0.1"
                                min="0"
                                max="3"
                                value={kw.bodyMult}
                                onChange={(e) => handleKeywordChange(docType as keyof typeof KEYWORD_MATRIX, 'strong', idx, 'bodyMult', parseFloat(e.target.value) || 1.0)}
                                className={kw.bodyMult > 1 ? 'border-green-500' : kw.bodyMult < 1 ? 'border-red-500' : ''}
                              />
                              <Input
                                type="number"
                                step="0.1"
                                min="0"
                                max="3"
                                value={kw.footerMult}
                                onChange={(e) => handleKeywordChange(docType as keyof typeof KEYWORD_MATRIX, 'strong', idx, 'footerMult', parseFloat(e.target.value) || 0.8)}
                                className={kw.footerMult > 1 ? 'border-green-500' : kw.footerMult < 1 ? 'border-red-500' : ''}
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveKeyword(docType as keyof typeof KEYWORD_MATRIX, 'strong', idx)}
                                className="flex-shrink-0"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Moderate Indicators */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <Label className="text-warning">Moderate Indicators (+2)</Label>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleAddKeyword(docType as keyof typeof KEYWORD_MATRIX, 'moderate')}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Add
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {/* Column Headers */}
                          <div className="grid grid-cols-[1fr_80px_80px_80px_40px] gap-2 text-xs text-muted-foreground font-medium px-2">
                            <div>Keyword</div>
                            <div>Header</div>
                            <div>Body</div>
                            <div>Footer</div>
                            <div></div>
                          </div>
                          {keywords.moderate.map((kw, idx) => (
                            <div key={idx} className="grid grid-cols-[1fr_80px_80px_80px_40px] gap-2">
                              <Input
                                value={kw.keyword}
                                onChange={(e) => handleKeywordChange(docType as keyof typeof KEYWORD_MATRIX, 'moderate', idx, 'keyword', e.target.value)}
                                placeholder="Keyword..."
                              />
                              <Input
                                type="number"
                                step="0.1"
                                min="0"
                                max="3"
                                value={kw.headerMult}
                                onChange={(e) => handleKeywordChange(docType as keyof typeof KEYWORD_MATRIX, 'moderate', idx, 'headerMult', parseFloat(e.target.value) || 1.2)}
                                className={kw.headerMult > 1 ? 'border-green-500' : kw.headerMult < 1 ? 'border-red-500' : ''}
                              />
                              <Input
                                type="number"
                                step="0.1"
                                min="0"
                                max="3"
                                value={kw.bodyMult}
                                onChange={(e) => handleKeywordChange(docType as keyof typeof KEYWORD_MATRIX, 'moderate', idx, 'bodyMult', parseFloat(e.target.value) || 1.0)}
                                className={kw.bodyMult > 1 ? 'border-green-500' : kw.bodyMult < 1 ? 'border-red-500' : ''}
                              />
                              <Input
                                type="number"
                                step="0.1"
                                min="0"
                                max="3"
                                value={kw.footerMult}
                                onChange={(e) => handleKeywordChange(docType as keyof typeof KEYWORD_MATRIX, 'moderate', idx, 'footerMult', parseFloat(e.target.value) || 0.8)}
                                className={kw.footerMult > 1 ? 'border-green-500' : kw.footerMult < 1 ? 'border-red-500' : ''}
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveKeyword(docType as keyof typeof KEYWORD_MATRIX, 'moderate', idx)}
                                className="flex-shrink-0"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Weak Indicators */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <Label>Weak Indicators (+1)</Label>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleAddKeyword(docType as keyof typeof KEYWORD_MATRIX, 'weak')}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Add
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {/* Column Headers */}
                          <div className="grid grid-cols-[1fr_80px_80px_80px_40px] gap-2 text-xs text-muted-foreground font-medium px-2">
                            <div>Keyword</div>
                            <div>Header</div>
                            <div>Body</div>
                            <div>Footer</div>
                            <div></div>
                          </div>
                          {keywords.weak.map((kw, idx) => (
                            <div key={idx} className="grid grid-cols-[1fr_80px_80px_80px_40px] gap-2">
                              <Input
                                value={kw.keyword}
                                onChange={(e) => handleKeywordChange(docType as keyof typeof KEYWORD_MATRIX, 'weak', idx, 'keyword', e.target.value)}
                                placeholder="Keyword..."
                              />
                              <Input
                                type="number"
                                step="0.1"
                                min="0"
                                max="3"
                                value={kw.headerMult}
                                onChange={(e) => handleKeywordChange(docType as keyof typeof KEYWORD_MATRIX, 'weak', idx, 'headerMult', parseFloat(e.target.value) || 1.2)}
                                className={kw.headerMult > 1 ? 'border-green-500' : kw.headerMult < 1 ? 'border-red-500' : ''}
                              />
                              <Input
                                type="number"
                                step="0.1"
                                min="0"
                                max="3"
                                value={kw.bodyMult}
                                onChange={(e) => handleKeywordChange(docType as keyof typeof KEYWORD_MATRIX, 'weak', idx, 'bodyMult', parseFloat(e.target.value) || 1.0)}
                                className={kw.bodyMult > 1 ? 'border-green-500' : kw.bodyMult < 1 ? 'border-red-500' : ''}
                              />
                              <Input
                                type="number"
                                step="0.1"
                                min="0"
                                max="3"
                                value={kw.footerMult}
                                onChange={(e) => handleKeywordChange(docType as keyof typeof KEYWORD_MATRIX, 'weak', idx, 'footerMult', parseFloat(e.target.value) || 0.8)}
                                className={kw.footerMult > 1 ? 'border-green-500' : kw.footerMult < 1 ? 'border-red-500' : ''}
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveKeyword(docType as keyof typeof KEYWORD_MATRIX, 'weak', idx)}
                                className="flex-shrink-0"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Exclusion Keywords */}
                      <div className="border-t pt-3 mt-3">
                        <div className="flex items-center justify-between mb-2">
                          <Label className="text-destructive">Exclusion Keywords</Label>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditedMatrix(prev => ({
                                ...prev,
                                [docType]: {
                                  ...prev[docType],
                                  exclusion: [...(prev[docType].exclusion || []), '']
                                }
                              }));
                            }}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Add
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {(keywords.exclusion || []).map((kw, idx) => (
                            <div key={idx} className="flex gap-2">
                              <Input
                                value={kw}
                                onChange={(e) => {
                                  setEditedMatrix(prev => ({
                                    ...prev,
                                    [docType]: {
                                      ...prev[docType],
                                      exclusion: prev[docType].exclusion?.map((k, i) => 
                                        i === idx ? e.target.value : k
                                      ) || []
                                    }
                                  }));
                                }}
                                placeholder="Exclusion keyword..."
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setEditedMatrix(prev => ({
                                    ...prev,
                                    [docType]: {
                                      ...prev[docType],
                                      exclusion: prev[docType].exclusion?.filter((_, i) => i !== idx) || []
                                    }
                                  }));
                                }}
                                className="flex-shrink-0"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                        <div className="mt-3">
                          <Label className="text-sm">Exclusion Penalty (%)</Label>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            value={(keywords as any).exclusionPenalty || 50}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 50;
                              setEditedMatrix(prev => ({
                                ...prev,
                                [docType]: { ...prev[docType], exclusionPenalty: val }
                              }));
                            }}
                            className="mt-1"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={isLoading}>
                    {isLoading ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent>
          <div className="space-y-4">
            {Object.entries(editedMatrix).map(([docType, keywords]) => (
              <div key={docType} className="border rounded-lg p-4">
                <h4 className="font-semibold mb-3">{docType}</h4>
                <div className="grid gap-3">
                  {keywords.strong.length > 0 && (
                    <div>
                      <span className="text-sm font-medium text-success">Strong (+3): </span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {keywords.strong.map((kw, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {kw.keyword}
                            <span className="ml-1 text-muted-foreground text-[10px]">
                              H:{kw.headerMult} B:{kw.bodyMult} F:{kw.footerMult}
                            </span>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {keywords.moderate.length > 0 && (
                    <div>
                      <span className="text-sm font-medium text-warning">Moderate (+2): </span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {keywords.moderate.map((kw, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {kw.keyword}
                            <span className="ml-1 text-muted-foreground text-[10px]">
                              H:{kw.headerMult} B:{kw.bodyMult} F:{kw.footerMult}
                            </span>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {keywords.weak.length > 0 && (
                    <div>
                      <span className="text-sm font-medium">Weak (+1): </span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {keywords.weak.map((kw, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {kw.keyword}
                            <span className="ml-1 text-muted-foreground text-[10px]">
                              H:{kw.headerMult} B:{kw.bodyMult} F:{kw.footerMult}
                            </span>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
};
