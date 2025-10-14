export interface ChunkInfo {
  chunkIndex: number;
  startPage: number;
  endPage: number;
  pageCount: number;
}

export const calculateChunks = (totalPages: number): ChunkInfo[] => {
  if (totalPages <= 3) {
    return [{
      chunkIndex: 1,
      startPage: 1,
      endPage: totalPages,
      pageCount: totalPages
    }];
  }

  const chunks: ChunkInfo[] = [];
  let currentPage = 1;
  let chunkIndex = 1;

  while (currentPage <= totalPages) {
    const endPage = Math.min(currentPage + 2, totalPages);
    const pageCount = endPage - currentPage + 1;

    chunks.push({
      chunkIndex,
      startPage: currentPage,
      endPage,
      pageCount
    });

    currentPage = endPage + 1;
    chunkIndex++;
  }

  return chunks;
};

export const aggregateChunkResults = (
  chunks: Array<{
    chunkIndex: number;
    pageCount: number;
    probableType: string;
    confidencePercentage: number;
  }>
): { finalType: string; finalConfidence: number } => {
  if (chunks.length === 0) {
    return { finalType: "Unknown", finalConfidence: 0 };
  }

  if (chunks.length === 1) {
    return {
      finalType: chunks[0].probableType,
      finalConfidence: chunks[0].confidencePercentage
    };
  }

  const totalPages = chunks.reduce((sum, chunk) => sum + chunk.pageCount, 0);

  // Calculate weighted scores for each document type
  const typeScores: Record<string, number> = {};
  
  chunks.forEach(chunk => {
    const weight = chunk.pageCount / totalPages;
    const weightedConfidence = chunk.confidencePercentage * weight;
    
    if (!typeScores[chunk.probableType]) {
      typeScores[chunk.probableType] = 0;
    }
    typeScores[chunk.probableType] += weightedConfidence;
  });

  // Find the type with highest weighted score
  let maxType = "Unknown";
  let maxScore = 0;

  Object.entries(typeScores).forEach(([type, score]) => {
    if (score > maxScore) {
      maxScore = score;
      maxType = type;
    }
  });

  // Check for variance across chunks
  const confidences = chunks.map(c => c.confidencePercentage);
  const avgConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;
  const variance = confidences.reduce((sum, conf) => {
    return sum + Math.pow(conf - avgConfidence, 2);
  }, 0) / confidences.length;
  const stdDev = Math.sqrt(variance);

  // If variance is too high, mark as mixed
  if (stdDev > 20 && chunks.length > 1) {
    return { finalType: "Mixed Document", finalConfidence: maxScore };
  }

  // If final confidence is below threshold, mark as unknown
  if (maxScore < 40) {
    return { finalType: "Unknown", finalConfidence: maxScore };
  }

  return { finalType: maxType, finalConfidence: maxScore };
};
