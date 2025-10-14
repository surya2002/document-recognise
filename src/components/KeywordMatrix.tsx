import { KEYWORD_MATRIX } from "@/types/document";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const KeywordMatrix = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Weighted Keyword Matrix</CardTitle>
      </CardHeader>
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
    </Card>
  );
};
