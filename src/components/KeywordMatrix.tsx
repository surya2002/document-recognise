import { useState } from "react";
import { KEYWORD_MATRIX } from "@/types/document";
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

export const KeywordMatrix = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editedMatrix, setEditedMatrix] = useState(KEYWORD_MATRIX);
  const [newDocType, setNewDocType] = useState("");

  const handleKeywordChange = (docType: keyof typeof KEYWORD_MATRIX, level: 'strong' | 'moderate' | 'weak', index: number, value: string) => {
    setEditedMatrix(prev => ({
      ...prev,
      [docType]: {
        ...prev[docType],
        [level]: prev[docType][level].map((kw, i) => 
          i === index ? value : kw
        )
      }
    }));
  };

  const handleAddKeyword = (docType: keyof typeof KEYWORD_MATRIX, level: 'strong' | 'moderate' | 'weak') => {
    setEditedMatrix(prev => ({
      ...prev,
      [docType]: {
        ...prev[docType],
        [level]: [...prev[docType][level], '']
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
        weak: []
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

  const handleSave = () => {
    // Filter out empty keywords before saving
    const cleanedMatrix = Object.fromEntries(
      Object.entries(editedMatrix).map(([docType, keywords]) => [
        docType,
        {
          strong: keywords.strong.filter(kw => kw.trim() !== ''),
          moderate: keywords.moderate.filter(kw => kw.trim() !== ''),
          weak: keywords.weak.filter(kw => kw.trim() !== '')
        }
      ])
    ) as typeof KEYWORD_MATRIX;
    
    Object.assign(KEYWORD_MATRIX, cleanedMatrix);
    setIsEditOpen(false);
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
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Keyword Matrix</DialogTitle>
                <DialogDescription>
                  Customize the keywords used for document classification. Use + to add indicators and X to remove them.
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
                          {keywords.strong.map((kw, idx) => (
                            <div key={idx} className="flex gap-2">
                              <Input
                                value={kw}
                                onChange={(e) => handleKeywordChange(docType as keyof typeof KEYWORD_MATRIX, 'strong', idx, e.target.value)}
                                placeholder="Enter keyword..."
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
                          {keywords.moderate.map((kw, idx) => (
                            <div key={idx} className="flex gap-2">
                              <Input
                                value={kw}
                                onChange={(e) => handleKeywordChange(docType as keyof typeof KEYWORD_MATRIX, 'moderate', idx, e.target.value)}
                                placeholder="Enter keyword..."
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
                          {keywords.weak.map((kw, idx) => (
                            <div key={idx} className="flex gap-2">
                              <Input
                                value={kw}
                                onChange={(e) => handleKeywordChange(docType as keyof typeof KEYWORD_MATRIX, 'weak', idx, e.target.value)}
                                placeholder="Enter keyword..."
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
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave}>
                  Save Changes
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-semibold">Document Type</th>
                  <th className="text-left py-3 px-4 font-semibold">Strong Indicators (+3)</th>
                  <th className="text-left py-3 px-4 font-semibold">Moderate (+2)</th>
                  <th className="text-left py-3 px-4 font-semibold">Weak (+1)</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(KEYWORD_MATRIX).map(([docType, keywords]) => (
                  <tr key={docType} className="border-b hover:bg-muted/50">
                    <td className="py-3 px-4 font-medium">{docType}</td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {keywords.strong.map((kw) => (
                          <Badge key={kw} variant="default" className="bg-success">
                            {kw}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {keywords.moderate.map((kw) => (
                          <Badge key={kw} variant="default" className="bg-warning">
                            {kw}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {keywords.weak.map((kw) => (
                          <Badge key={kw} variant="secondary">
                            {kw}
                          </Badge>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      )}
    </Card>
  );
};
