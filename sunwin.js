/**
 * =====================================================================
 * SUNWIN API SERVER v5.0 - PHẦN 1/5
 * IMPORTS + CONFIG + PATTERN DATABASE + UTILITIES
 * =====================================================================
 */

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ============================================================
// CONFIG
// ============================================================
const HISTORY_API = "https://kwinstore.com/sunwin/tx/history/b3887b973c538cfb0491c5125b9042fde785e2d3f33858a5";
const POLL_INTERVAL = 5000;

// ============================================================
// GLOBAL STATE
// ============================================================
let rikResults = [];
let rikCurrentSession = null;
let pollInterval = null;
let lstmModel = null;

// ============================================================
// PATTERN DATABASE
// ============================================================
const PATTERN_DATABASE = {
    '1-1': ['tx', 'xt'], 'bệt': ['tt', 'xx'], '2-2': ['ttxx', 'xxtt'],
    '3-3': ['tttxxx', 'xxxttt'], '4-4': ['ttttxxxx', 'xxxxtttt'],
    '5-5': ['tttttxxxxx', 'xxxxxttttt'], '1-2-1': ['txxxt', 'xtttx'],
    '2-1-2': ['ttxtt', 'xxtxx'], '1-2-3': ['txxttt', 'xttxxx'],
    '3-2-3': ['tttxttt', 'xxxtxxx'], '4-2-4': ['ttttxxtttt', 'xxxxttxxxx'],
    '1-3-1': ['txtttx', 'xtxxxt'], '2-3-2': ['ttxxtt', 'xxttxx'],
    '3-4-3': ['tttxxxxttt', 'xxxttttxxx'], '4-3-4': ['ttttxxxtttt', 'xxxxtttxxxx'],
    '1-2-1-2': ['txxxtx', 'xtttxt'], '2-1-2-1': ['ttxttx', 'xxtxxt'],
    '1-1-2-2': ['txttxx', 'xtxxxt'], '2-2-1-1': ['ttxxtx', 'xxttxx'],
    'zigzag': ['txt', 'xtx'], 'double_zigzag': ['txtxt', 'xtxtx'],
    'triple_zigzag': ['txtxtxt', 'xtxtxtx'], 'quad_alternate': ['txtxtxtx', 'xtxtxtxt'],
    'penta_alternate': ['txtxtxtxtx', 'xtxtxtxtxt'],
    'fibonacci_3': ['txt', 'xtx'], 'fibonacci_4': ['txttx', 'xtxxt'],
    'fibonacci_5': ['txttxttx', 'xtxtxxxt'],
    'triangle': ['txx', 'xtt'], 'square': ['ttxx', 'xxtt'],
    'pentagon': ['tttxx', 'xxxtt'], 'hexagon': ['ttttxx', 'xxxxxt'],
    'wave_2': ['ttxx', 'xxtt'], 'wave_3': ['tttxxx', 'xxxttt'],
    'wave_4': ['ttttxxxx', 'xxxxtttt'], 'wave_5': ['tttttxxxxx', 'xxxxxttttt'],
    'reverse_1': ['ttx', 'xxt'], 'reverse_2': ['ttxx', 'xxtt'],
    'reverse_3': ['tttxxx', 'xxxttt'], 'reverse_4': ['ttttxxxx', 'xxxxtttt'],
    'interlace_1': ['txtxt', 'xtxtx'], 'interlace_2': ['ttxxtt', 'xxttxx'],
    'interlace_3': ['tttxxttt', 'xxxxtxxx'],
    'branch_1': ['ttxtx', 'xxtxt'], 'branch_2': ['ttxxttx', 'xxttxx'],
    'spiral_1': ['txxxt', 'xtttx'], 'spiral_2': ['ttxxxtt', 'xxtttxx'],
    'spiral_3': ['tttxxxxttt', 'xxxttttxxx'],
    'arithmetic_2': ['txx', 'xtt'], 'arithmetic_3': ['txxx', 'xttt'],
    'arithmetic_4': ['txxxx', 'xtttt'],
    'geometric_2': ['txx', 'xtt'], 'geometric_3': ['txxx', 'xttt'],
    'mixed_1': ['ttxtxx', 'xxtxtt'], 'mixed_2': ['txxxttx', 'xtttxxt'],
    'mixed_3': ['tttxxtxx', 'xxxxttxx'], 'mixed_4': ['txttxtxt', 'xtxtxtxt'],
    'mixed_5': ['ttxxtxtt', 'xxtxtxxt'],
    'symmetry_1': ['txt', 'xtx'], 'symmetry_2': ['ttxxtt', 'xxttxx'],
    'symmetry_3': ['tttxxxttt', 'xxxxttxxx'],
    'repeat_1': ['tt', 'xx'], 'repeat_2': ['tttt', 'xxxx'],
    'repeat_3': ['tttttt', 'xxxxxx'], 'repeat_4': ['tttttttt', 'xxxxxxxx'],
    'alternate_1': ['txtx', 'xtxt'], 'alternate_2': ['txtxtx', 'xtxtxt'],
    'alternate_3': ['txtxtxtx', 'xtxtxtxt'], 'alternate_4': ['txtxtxtxtx', 'xtxtxtxtxt'],
};

// ============================================================
// UTILITIES
// ============================================================
function parseLines(lines) {
    try {
        const arr = lines.map(l => (typeof l === 'string' ? JSON.parse(l) : l));
        return arr.map(item => ({
            session: Number(item.session) || 0,
            dice: Array.isArray(item.dice) ? item.dice : [],
            total: Number(item.total) || 0,
            result: item.result || '',
            tx: (Number(item.total) || 0) >= 11 ? 'T' : 'X'
        })).sort((a, b) => a.session - b.session);
    } catch (e) {
        console.error("Lỗi parseLines:", e.message);
        return [];
    }
}

// ============================================================
// DATASET ANALYZER
// ============================================================
class PatternDatasetAnalyzer {
    constructor() {
        this.patterns = [];
        this.nGramStats = {};
        this.transitionMatrix = {};
        this.patternFreq = {};
        this.maxLen = 0;
        this.minLen = 99;
        this.totalSamples = 0;
    }

    loadFromHistory(historyRecords) {
        this.patterns = [];
        this.nGramStats = {};
        this.transitionMatrix = {};
        this.patternFreq = {};
        this.maxLen = 0;
        this.minLen = 99;
        this.totalSamples = 0;

        const tx = historyRecords.map(h => h.tx.toLowerCase());
        if (tx.length < 20) return false;

        const fullStr = tx.join('');

        for (let winLen = 4; winLen <= 16; winLen++) {
            for (let i = 0; i <= fullStr.length - winLen - 1; i++) {
                const patternStr = fullStr.substr(i, winLen);
                const nextResult = fullStr[i + winLen];

                this.patterns.push({ pattern: patternStr, next: nextResult });
                this.maxLen = Math.max(this.maxLen, winLen);
                this.minLen = Math.min(this.minLen, winLen);
                this.totalSamples++;
            }
        }

        if (this.totalSamples === 0) return false;

        console.log(`📚 Dataset tự học: ${this.totalSamples} mẫu cầu`);

        this.buildNGramStats();
        this.buildTransitionMatrix();
        this.buildPatternFrequency();
        return true;
    }

    buildNGramStats() {
        for (let n = 1; n <= 6; n++) this.nGramStats[n] = {};
        for (const { pattern, next } of this.patterns) {
            for (let n = 1; n <= 6; n++) {
                for (let i = 0; i <= pattern.length - n; i++) {
                    const gram = pattern.substr(i, n);
                    if (!this.nGramStats[n][gram]) this.nGramStats[n][gram] = { t: 0, x: 0, total: 0 };
                    this.nGramStats[n][gram][next]++;
                    this.nGramStats[n][gram].total++;
                }
            }
        }
    }

    buildTransitionMatrix() {
        for (const { pattern, next } of this.patterns) {
            for (let n = 1; n <= 5; n++) {
                if (pattern.length < n) continue;
                const key = pattern.slice(-n);
                const matrixKey = `${n}:${key}`;
                if (!this.transitionMatrix[matrixKey]) this.transitionMatrix[matrixKey] = { t: 0, x: 0 };
                this.transitionMatrix[matrixKey][next]++;
            }
        }
    }

    buildPatternFrequency() {
        for (const { pattern } of this.patterns) {
            for (let len = 2; len <= 8; len++) {
                for (let i = 0; i <= pattern.length - len; i++) {
                    const sub = pattern.substr(i, len);
                    this.patternFreq[sub] = (this.patternFreq[sub] || 0) + 1;
                }
            }
        }
    }

    queryPattern(recentStr, maxLen = 8) {
        const results = [];
        const queryLower = recentStr.toLowerCase();
        for (const { pattern, next } of this.patterns) {
            const compareLen = Math.min(pattern.length, queryLower.length, maxLen);
            let matchLen = 0;
            for (let k = 1; k <= compareLen; k++) {
                if (pattern[pattern.length - k] === queryLower[queryLower.length - k]) matchLen = k;
                else break;
            }
            if (matchLen >= 4) results.push({ matchLen, pattern, next, weight: Math.pow(matchLen, 1.5) });
        }
        return results;
    }

    getNGramProbability(recentStr, n) {
        const queryLower = recentStr.toLowerCase();
        if (queryLower.length < n) return null;
        const key = queryLower.slice(-n);
        const stat = this.nGramStats[n]?.[key];
        if (!stat || stat.total < 5) return null;
        return { t: stat.t / stat.total, x: stat.x / stat.total, total: stat.total };
    }

    getMarkovPrediction(recentStr, n) {
        const queryLower = recentStr.toLowerCase();
        if (queryLower.length < n) return null;
        const key = queryLower.slice(-n);
        const stat = this.transitionMatrix[`${n}:${key}`];
        if (!stat || (stat.t + stat.x) < 10) return null;
        const total = stat.t + stat.x;
        return { t: stat.t / total, x: stat.x / total, total };
    }
}

const dataset = new PatternDatasetAnalyzer();
/**
 * =====================================================================
 * SUNWIN API SERVER v5.0 - PHẦN 2/5
 * 14 THUẬT TOÁN AI + HELPERS
 * =====================================================================
 */

function algo1_ultraPatternRecognition(history) {
    const tx = history.map(h => h.tx);
    if (tx.length < 30) return null;
    const txLower = tx.map(t => t.toLowerCase());
    const fullPattern = txLower.join('');
    let patternMatches = { t: 0, x: 0 };
    let totalWeight = 0;
    Object.entries(PATTERN_DATABASE).forEach(([patternName, patternList]) => {
        patternList.forEach(pattern => {
            const patternLength = pattern.length;
            if (patternLength > 8) return;
            for (let i = 0; i <= fullPattern.length - patternLength - 1; i++) {
                if (fullPattern.substr(i, patternLength) === pattern) {
                    const nextChar = fullPattern.charAt(i + patternLength);
                    if (nextChar === 't' || nextChar === 'x') {
                        const weight = (patternLength / 8) * (patternName.includes('complex') ? 1.5 : 1);
                        patternMatches[nextChar] += weight;
                        totalWeight += weight;
                    }
                }
            }
        });
    });
    if (totalWeight === 0) return null;
    const threshold = 0.65 + (Math.min(totalWeight, 50) / 100);
    const tProb = patternMatches.t / totalWeight;
    const xProb = patternMatches.x / totalWeight;
    if (tProb >= threshold) return 'T';
    if (xProb >= threshold) return 'X';
    return null;
}

function algo2_quantumAdaptiveAI(history) {
    if (history.length < 40) return null;
    const tx = history.map(h => h.tx);
    const totals = history.map(h => h.total);
    const quantumState = { t: 0.5, x: 0.5 };
    const recentCount = Math.min(20, history.length);
    for (let i = history.length - recentCount; i < history.length; i++) {
        const weight = 0.04;
        if (tx[i] === 'T') { quantumState.t *= (1 + weight); quantumState.x *= (1 - weight); }
        else { quantumState.x *= (1 + weight); quantumState.t *= (1 - weight); }
    }
    const recentAvg = totals.slice(-10).reduce((a, b) => a + b, 0) / 10;
    if (recentAvg > 11.2) { quantumState.t *= 0.85; quantumState.x *= 1.15; }
    else if (recentAvg < 9.8) { quantumState.t *= 1.15; quantumState.x *= 0.85; }
    const total = quantumState.t + quantumState.x;
    quantumState.t /= total; quantumState.x /= total;
    if (quantumState.t > 0.68) return 'T';
    if (quantumState.x > 0.68) return 'X';
    return null;
}

function algo3_deepTrendAnalysis(history) {
    if (history.length < 25) return null;
    const tx = history.map(h => h.tx);
    const totals = history.map(h => h.total);
    const periods = [5, 10, 15, 20];
    const trends = { t: 0, x: 0 };
    periods.forEach(period => {
        if (tx.length >= period) {
            const recent = tx.slice(-period);
            const tCount = recent.filter(c => c === 'T').length;
            const xCount = recent.filter(c => c === 'X').length;
            if (tCount > xCount) trends.t += 1;
            else if (xCount > tCount) trends.x += 1;
        }
    });
    const totalAvg = totals.reduce((a, b) => a + b, 0) / totals.length;
    const recentAvg = totals.slice(-8).reduce((a, b) => a + b, 0) / 8;
    if (recentAvg > totalAvg + 0.8) trends.t += 1.5;
    if (recentAvg < totalAvg - 0.8) trends.x += 1.5;
    if (trends.t > trends.x + 1.5) return 'T';
    if (trends.x > trends.t + 1.5) return 'X';
    return null;
}

function algo4_smartBridgeDetection(history) {
    const tx = history.map(h => h.tx);
    if (tx.length < 15) return null;
    const recentTx = tx.slice(-15);
    const lastResult = recentTx[recentTx.length - 1];
    let runLength = 1;
    for (let i = recentTx.length - 2; i >= 0; i--) {
        if (recentTx[i] === lastResult) runLength++;
        else break;
    }
    if (runLength >= 2 && runLength <= 4) {
        const patternStr = recentTx.slice(-8).join('').toLowerCase();
        const strongPatterns = ['tttt', 'xxxx', 'txtxtx', 'xtxtxt'];
        let inStrongPattern = false;
        strongPatterns.forEach(pattern => { if (patternStr.includes(pattern)) inStrongPattern = true; });
        if (inStrongPattern) return lastResult;
        const overallTrend = calculateOverallTrend(tx);
        if (overallTrend === lastResult) return lastResult;
    }
    if (runLength >= 5) return lastResult === 'T' ? 'X' : 'T';
    const lastPattern = recentTx.slice(-6).join('').toLowerCase();
    const reversalPatterns = ['tttxxx', 'xxxttt', 'ttxx', 'xxtt', 'txtxtx', 'xtxtxt'];
    if (reversalPatterns.includes(lastPattern)) return lastResult === 'T' ? 'X' : 'T';
    return null;
}

function algo5_volatilityPrediction(history) {
    if (history.length < 30) return null;
    const totals = history.map(h => h.total);
    const recent10 = totals.slice(-10);
    const recent20 = totals.slice(-20);
    const vol10 = calculateVolatility(recent10);
    const vol20 = calculateVolatility(recent20);
    if (vol10 > vol20 * 1.5) {
        const avgRecent = recent10.reduce((a, b) => a + b, 0) / 10;
        if (avgRecent > 11.0) return 'X';
        if (avgRecent < 10.0) return 'T';
    } else if (vol10 < vol20 * 0.7) {
        const recentTx = history.slice(-10).map(h => h.tx);
        const tCount = recentTx.filter(t => t === 'T').length;
        const xCount = recentTx.filter(t => t === 'X').length;
        if (tCount > xCount + 2) return 'T';
        if (xCount > tCount + 2) return 'X';
    }
    return null;
}

function algo6_patternFusionAI(history) {
    const tx = history.map(h => h.tx);
    if (tx.length < 35) return null;
    const txLower = tx.map(t => t.toLowerCase());
    const patterns = [];
    const patternTypes = [
        { name: 'basic', length: 3, weight: 0.3 },
        { name: 'advanced', length: 5, weight: 0.5 },
        { name: 'complex', length: 7, weight: 0.7 }
    ];
    patternTypes.forEach(type => {
        if (txLower.length >= type.length + 1) {
            const lastPattern = txLower.slice(-type.length).join('');
            let matches = { t: 0, x: 0 };
            for (let i = 0; i <= txLower.length - type.length - 1; i++) {
                if (txLower.slice(i, i + type.length).join('') === lastPattern) matches[txLower[i + type.length]]++;
            }
            const total = matches.t + matches.x;
            if (total >= 2) {
                const confidence = Math.max(matches.t, matches.x) / total;
                if (confidence > 0.7) {
                    patterns.push({
                        prediction: matches.t > matches.x ? 'T' : 'X',
                        confidence: confidence * type.weight
                    });
                }
            }
        }
    });
    if (patterns.length === 0) return null;
    const combined = { t: 0, x: 0 };
    patterns.forEach(p => { if (p.prediction === 'T') combined.t += p.confidence; else combined.x += p.confidence; });
    if (combined.t > combined.x * 1.3) return 'T';
    if (combined.x > combined.t * 1.3) return 'X';
    return null;
}

function algo7_realtimeAdaptiveAI(history) {
    if (history.length < 20) return null;
    const tx = history.map(h => h.tx);
    const totals = history.map(h => h.total);
    const indicators = {
        rsi: calculateRSI(tx.slice(-14)),
        macd: calculateMACD(totals),
        bias: calculateBias(tx.slice(-20)),
        momentum: calculateMomentum(totals.slice(-10))
    };
    let tScore = 0, xScore = 0;
    if (indicators.rsi > 70) xScore += 1.5; else if (indicators.rsi < 30) tScore += 1.5;
    if (indicators.macd > 0.5) tScore += 1; else if (indicators.macd < -0.5) xScore += 1;
    if (indicators.bias > 0.6) tScore += 1.2; else if (indicators.bias < 0.4) xScore += 1.2;
    if (indicators.momentum > 0.3) tScore += 0.8; else if (indicators.momentum < -0.3) xScore += 0.8;
    if (tScore > xScore + 1.5) return 'T';
    if (xScore > tScore + 1.5) return 'X';
    return null;
}

function algo8_nGramMarkovAI(history) {
    if (history.length < 10 || dataset.totalSamples === 0) return null;
    const tx = history.map(h => h.tx.toLowerCase());
    const recent = tx.join('');
    let bestPrediction = null;
    let bestScore = 0;
    for (let n = 6; n >= 2; n--) {
        const prob = dataset.getNGramProbability(recent, n);
        if (!prob || prob.total < 3) continue;
        const confidence = Math.max(prob.t, prob.x);
        const score = confidence * Math.log10(prob.total + 1) * n;
        if (score > bestScore && confidence > 0.6) {
            bestScore = score;
            bestPrediction = prob.t > prob.x ? 'T' : 'X';
        }
    }
    if (!bestPrediction) {
        for (let n = 4; n >= 1; n--) {
            const markov = dataset.getMarkovPrediction(recent, n);
            if (!markov || markov.total < 5) continue;
            const conf = Math.max(markov.t, markov.x);
            if (conf > 0.62) { bestPrediction = markov.t > markov.x ? 'T' : 'X'; break; }
        }
    }
    return bestPrediction;
}

function algo9_frequencyPatternMiner(history) {
    if (history.length < 15 || dataset.totalSamples === 0) return null;
    const tx = history.map(h => h.tx.toLowerCase());
    const recent = tx.slice(-10).join('');
    const matches = dataset.queryPattern(recent, 10);
    if (matches.length < 3) return null;
    matches.sort((a, b) => b.weight - a.weight);
    const top = matches.slice(0, 50);
    let tVotes = 0, xVotes = 0, totalWeight = 0;
    for (const m of top) {
        if (m.next === 't') tVotes += m.weight; else xVotes += m.weight;
        totalWeight += m.weight;
    }
    if (totalWeight === 0) return null;
    const tProb = tVotes / totalWeight;
    const xProb = xVotes / totalWeight;
    if (tProb > 0.7) return 'T';
    if (xProb > 0.7) return 'X';
    return null;
}

function algo10_adaptiveWindowMatcher(history) {
    if (history.length < 20 || dataset.totalSamples === 0) return null;
    const tx = history.map(h => h.tx.toLowerCase());
    const windows = [12, 10, 8, 6];
    for (const winSize of windows) {
        if (tx.length < winSize) continue;
        const window = tx.slice(-winSize).join('');
        const matches = [];
        for (const { pattern, next } of dataset.patterns) {
            if (pattern.length < winSize) continue;
            if (pattern.slice(-winSize) === window) matches.push(next);
        }
        if (matches.length >= 3) {
            const tCount = matches.filter(m => m === 't').length;
            const xCount = matches.length - tCount;
            const conf = Math.max(tCount, xCount) / matches.length;
            const threshold = winSize >= 10 ? 0.7 : 0.65;
            if (conf >= threshold) return tCount > xCount ? 'T' : 'X';
        }
    }
    return null;
}

function algo11_statisticalBiasDetector(history) {
    if (history.length < 30) return null;
    const tx = history.map(h => h.tx);
    const frames = [
        { data: tx.slice(-10), weight: 1.5 },
        { data: tx.slice(-20), weight: 1.0 },
        { data: tx.slice(-30), weight: 0.7 }
    ];
    let biasScore = 0, totalWeight = 0;
    for (const frame of frames) {
        const tCount = frame.data.filter(t => t === 'T').length;
        const xCount = frame.data.length - tCount;
        const bias = (tCount - xCount) / frame.data.length;
        biasScore += bias * frame.weight;
        totalWeight += frame.weight;
    }
    biasScore /= totalWeight;
    const recentBias = (tx.slice(-5).filter(t => t === 'T').length - tx.slice(-5).filter(t => t === 'X').length) / 5;
    if (Math.abs(recentBias - biasScore) > 0.6) return recentBias > 0 ? 'X' : 'T';
    if (biasScore > 0.35) return 'T';
    if (biasScore < -0.35) return 'X';
    return null;
}

function algo12_ensembleMetaLearner(history) {
    if (history.length < 25 || dataset.totalSamples === 0) return null;
    const subPredictions = [];
    const subAlgos = [
        algo1_ultraPatternRecognition, algo3_deepTrendAnalysis, algo4_smartBridgeDetection,
        algo8_nGramMarkovAI, algo9_frequencyPatternMiner, algo10_adaptiveWindowMatcher,
        algo11_statisticalBiasDetector
    ];
    for (const fn of subAlgos) {
        try {
            const p = fn(history);
            if (p === 'T' || p === 'X') subPredictions.push(p);
        } catch (e) {}
    }
    if (subPredictions.length < 3) return null;
    const tCount = subPredictions.filter(p => p === 'T').length;
    const xCount = subPredictions.length - tCount;
    const consensus = Math.max(tCount, xCount) / subPredictions.length;
    if (consensus < 0.7) return null;
    return tCount > xCount ? 'T' : 'X';
}

function algo13_lstmSequenceAI(history) {
    if (!lstmModel || history.length < 10) return null;
    const tx = history.map(h => h.tx);
    const result = lstmModel.predict(tx);
    if (!result || result.confidence < 0.65) return null;
    return result.prediction;
}

function algo14_lstmDatasetHybrid(history) {
    if (!lstmModel || history.length < 15 || dataset.totalSamples === 0) return null;
    const tx = history.map(h => h.tx);
    const lstmResult = lstmModel.predict(tx);
    if (!lstmResult) return null;
    const recent = tx.slice(-10).join('').toLowerCase();
    const matches = dataset.queryPattern(recent, 10);
    if (matches.length < 3) return lstmResult.confidence > 0.7 ? lstmResult.prediction : null;
    let tVotes = 0, xVotes = 0;
    for (const m of matches) {
        if (m.next === 't') tVotes += m.weight; else xVotes += m.weight;
    }
    const datasetPred = tVotes > xVotes ? 'T' : 'X';
    const datasetConf = Math.max(tVotes, xVotes) / (tVotes + xVotes);
    if (lstmResult.prediction === datasetPred) {
        const combinedConf = (lstmResult.confidence + datasetConf) / 2;
        if (combinedConf > 0.7) return datasetPred;
    }
    if (lstmResult.confidence > datasetConf + 0.15) return lstmResult.prediction;
    if (datasetConf > lstmResult.confidence + 0.15) return datasetPred;
    return null;
}

// --- HELPERS ---
function calculateVolatility(numbers) {
    const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
    const variance = numbers.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / numbers.length;
    return Math.sqrt(variance);
}
function calculateOverallTrend(txArray) {
    if (txArray.length < 10) return null;
    const tCount = txArray.filter(t => t === 'T').length;
    const xCount = txArray.filter(t => t === 'X').length;
    if (tCount > xCount * 1.3) return 'T';
    if (xCount > tCount * 1.3) return 'X';
    return null;
}
function calculateRSI(txArray) {
    if (txArray.length < 14) return 50;
    let gains = 0, losses = 0;
    for (let i = 1; i < txArray.length; i++) {
        if (txArray[i] === 'T' && txArray[i-1] === 'X') gains++;
        else if (txArray[i] === 'X' && txArray[i-1] === 'T') losses++;
    }
    if (losses === 0) return 100;
    return 100 - (100 / (1 + gains / losses));
}
function calculateMACD(totals) {
    if (totals.length < 26) return 0;
    const ema12 = calculateEMA(totals.slice(-12), 12);
    const ema26 = calculateEMA(totals.slice(-26), 26);
    return ema12 - ema26;
}
function calculateEMA(numbers, period) {
    const multiplier = 2 / (period + 1);
    let ema = numbers[0];
    for (let i = 1; i < numbers.length; i++) ema = numbers[i] * multiplier + ema * (1 - multiplier);
    return ema;
}
function calculateBias(txArray) { return txArray.filter(t => t === 'T').length / txArray.length; }
function calculateMomentum(numbers) {
    if (numbers.length < 2) return 0;
    return numbers[numbers.length - 1] - numbers[0];
}

const ALGORITHMS = [
    { id: 'ultra_pattern',  fn: algo1_ultraPatternRecognition,  name: 'Ultra Pattern AI' },
    { id: 'quantum_ai',     fn: algo2_quantumAdaptiveAI,        name: 'Quantum Adaptive AI' },
    { id: 'deep_trend',     fn: algo3_deepTrendAnalysis,        name: 'Deep Trend AI' },
    { id: 'smart_bridge',   fn: algo4_smartBridgeDetection,     name: 'Smart Bridge AI' },
    { id: 'volatility',     fn: algo5_volatilityPrediction,     name: 'Volatility AI' },
    { id: 'pattern_fusion', fn: algo6_patternFusionAI,          name: 'Pattern Fusion AI' },
    { id: 'realtime_ai',    fn: algo7_realtimeAdaptiveAI,       name: 'Real-time Adaptive AI' },
    { id: 'ngram_markov',   fn: algo8_nGramMarkovAI,            name: 'N-Gram Markov AI' },
    { id: 'freq_miner',     fn: algo9_frequencyPatternMiner,    name: 'Frequency Pattern Miner' },
    { id: 'window_matcher', fn: algo10_adaptiveWindowMatcher,   name: 'Adaptive Window Matcher' },
    { id: 'stat_bias',      fn: algo11_statisticalBiasDetector, name: 'Statistical Bias Detector' },
    { id: 'ensemble_meta',  fn: algo12_ensembleMetaLearner,     name: 'Ensemble Meta-Learner' },
    { id: 'lstm_seq',       fn: algo13_lstmSequenceAI,          name: 'LSTM Sequence AI' },
    { id: 'lstm_hybrid',    fn: algo14_lstmDatasetHybrid,       name: 'LSTM-Dataset Hybrid' },
];
/**
 * =====================================================================
 * SUNWIN API SERVER v5.0 - PHẦN 3/5
 * LSTM MODEL
 * =====================================================================
 */

class LSTMLikeModel {
    constructor(hiddenSize = 16, learningRate = 0.01) {
        this.hiddenSize = hiddenSize;
        this.inputSize = 2;
        this.outputSize = 2;
        this.learningRate = learningRate;
        this.Wf = this.initMatrix(hiddenSize, hiddenSize + this.inputSize);
        this.Wi = this.initMatrix(hiddenSize, hiddenSize + this.inputSize);
        this.Wo = this.initMatrix(hiddenSize, hiddenSize + this.inputSize);
        this.Wc = this.initMatrix(hiddenSize, hiddenSize + this.inputSize);
        this.bf = this.initVector(hiddenSize, 1.0);
        this.bi = this.initVector(hiddenSize, 0.0);
        this.bo = this.initVector(hiddenSize, 0.0);
        this.bc = this.initVector(hiddenSize, 0.0);
        this.Wy = this.initMatrix(this.outputSize, hiddenSize);
        this.by = this.initVector(this.outputSize, 0.0);
        this.h = new Array(hiddenSize).fill(0);
        this.c = new Array(hiddenSize).fill(0);
        this.trainSteps = 0;
        this.trainLoss = 0;
        this.lastAccuracy = 0;
    }
    initMatrix(rows, cols) {
        const m = [];
        const scale = Math.sqrt(2.0 / cols);
        for (let i = 0; i < rows; i++) {
            const row = [];
            for (let j = 0; j < cols; j++) row.push((Math.random() * 2 - 1) * scale);
            m.push(row);
        }
        return m;
    }
    initVector(size, fill = 0) { return new Array(size).fill(fill); }
    sigmoid(x) { if (x > 20) return 1; if (x < -20) return 0; return 1 / (1 + Math.exp(-x)); }
    tanh(x) { return Math.tanh(x); }
    softmax(arr) {
        const max = Math.max(...arr);
        const exps = arr.map(v => Math.exp(v - max));
        const sum = exps.reduce((a, b) => a + b, 0);
        return exps.map(v => v / sum);
    }
    forward(input, h, c) {
        const combined = [...h, ...input];
        const f = [], i_gate = [], c_cand = [], o_gate = [];
        for (let i = 0; i < this.hiddenSize; i++) {
            let sumF = this.bf[i], sumI = this.bi[i], sumC = this.bc[i], sumO = this.bo[i];
            for (let j = 0; j < combined.length; j++) {
                sumF += this.Wf[i][j] * combined[j];
                sumI += this.Wi[i][j] * combined[j];
                sumC += this.Wc[i][j] * combined[j];
                sumO += this.Wo[i][j] * combined[j];
            }
            f.push(this.sigmoid(sumF));
            i_gate.push(this.sigmoid(sumI));
            c_cand.push(this.tanh(sumC));
            o_gate.push(this.sigmoid(sumO));
        }
        const c_new = [], h_new = [];
        for (let i = 0; i < this.hiddenSize; i++) {
            c_new.push(f[i] * c[i] + i_gate[i] * c_cand[i]);
            h_new.push(o_gate[i] * this.tanh(c_new[i]));
        }
        const logits = [];
        for (let k = 0; k < this.outputSize; k++) {
            let sum = this.by[k];
            for (let i = 0; i < this.hiddenSize; i++) sum += this.Wy[k][i] * h_new[i];
            logits.push(sum);
        }
        const probs = this.softmax(logits);
        return { probs, cache: { input, h, c, combined, f, i_gate, c_cand, c_new, o_gate, h_new, logits } };
    }
    forwardSequence(sequence) {
        let h = new Array(this.hiddenSize).fill(0);
        let c = new Array(this.hiddenSize).fill(0);
        let lastOutput = null;
        for (const input of sequence) {
            const out = this.forward(input, h, c);
            h = out.cache.h_new;
            c = out.cache.c_new;
            lastOutput = out;
        }
        return { probs: lastOutput ? lastOutput.probs : [0.5, 0.5], finalH: h, finalC: c };
    }
    trainStep(sequence, targetIdx) {
        let h = new Array(this.hiddenSize).fill(0);
        let c = new Array(this.hiddenSize).fill(0);
        const caches = [];
        for (const input of sequence) {
            const out = this.forward(input, h, c);
            caches.push(out.cache);
            h = out.cache.h_new;
            c = out.cache.c_new;
        }
        const lastCache = caches[caches.length - 1];
        const probs = this.softmax(lastCache.logits);
        const dLogits = probs.slice();
        dLogits[targetIdx] -= 1;
        this.trainLoss = -Math.log(Math.max(probs[targetIdx], 1e-10));
        const dWy = [];
        for (let k = 0; k < this.outputSize; k++) {
            const row = [];
            for (let i = 0; i < this.hiddenSize; i++) row.push(dLogits[k] * lastCache.h_new[i]);
            dWy.push(row);
        }
        const dh_next = new Array(this.hiddenSize).fill(0);
        for (let i = 0; i < this.hiddenSize; i++) {
            let sum = 0;
            for (let k = 0; k < this.outputSize; k++) sum += this.Wy[k][i] * dLogits[k];
            dh_next[i] = sum;
        }
        for (let k = 0; k < this.outputSize; k++) {
            this.by[k] -= this.learningRate * dLogits[k];
            for (let i = 0; i < this.hiddenSize; i++) this.Wy[k][i] -= this.learningRate * dWy[k][i];
        }
        const bpttSteps = Math.min(2, caches.length);
        let dc_next = new Array(this.hiddenSize).fill(0);
        let dh_carry = dh_next;
        for (let t = caches.length - 1; t >= caches.length - bpttSteps; t--) {
            const cache = caches[t];
            const prevC = t > 0 ? caches[t - 1].c_new : new Array(this.hiddenSize).fill(0);
            const dC = [], dO = [], dI = [], dCcand = [], dF = [];
            for (let i = 0; i < this.hiddenSize; i++) {
                const tanhC = this.tanh(cache.c_new[i]);
                dC.push(dh_carry[i] * cache.o_gate[i] * (1 - tanhC * tanhC) + dc_next[i]);
                dO.push(dh_carry[i] * this.tanh(cache.c_new[i]));
                dI.push(dC[i] * cache.c_cand[i]);
                dCcand.push(dC[i] * cache.i_gate[i]);
                dF.push(dC[i] * prevC[i]);
            }
            const dO_pre = [], dI_pre = [], dF_pre = [], dC_pre = [];
            for (let i = 0; i < this.hiddenSize; i++) {
                dO_pre.push(dO[i] * cache.o_gate[i] * (1 - cache.o_gate[i]));
                dI_pre.push(dI[i] * cache.i_gate[i] * (1 - cache.i_gate[i]));
                dF_pre.push(dF[i] * cache.f[i] * (1 - cache.f[i]));
                dC_pre.push(dCcand[i] * (1 - cache.c_cand[i] * cache.c_cand[i]));
            }
            const combined = cache.combined;
            for (let i = 0; i < this.hiddenSize; i++) {
                this.bf[i] -= this.learningRate * dF_pre[i];
                this.bi[i] -= this.learningRate * dI_pre[i];
                this.bo[i] -= this.learningRate * dO_pre[i];
                this.bc[i] -= this.learningRate * dC_pre[i];
                for (let j = 0; j < combined.length; j++) {
                    const g = combined[j];
                    this.Wf[i][j] -= this.learningRate * dF_pre[i] * g;
                    this.Wi[i][j] -= this.learningRate * dI_pre[i] * g;
                    this.Wo[i][j] -= this.learningRate * dO_pre[i] * g;
                    this.Wc[i][j] -= this.learningRate * dC_pre[i] * g;
                }
            }
            const dh_prev = new Array(this.hiddenSize).fill(0);
            for (let j = 0; j < this.hiddenSize; j++) {
                let sum = 0;
                for (let i = 0; i < this.hiddenSize; i++) {
                    sum += dF_pre[i] * this.Wf[i][j] + dI_pre[i] * this.Wi[i][j] +
                           dO_pre[i] * this.Wo[i][j] + dC_pre[i] * this.Wc[i][j];
                }
                dh_prev[j] = sum;
            }
            const dc_prev = new Array(this.hiddenSize).fill(0);
            for (let i = 0; i < this.hiddenSize; i++) dc_prev[i] = dC[i] * cache.f[i];
            dh_carry = dh_prev;
            dc_next = dc_prev;
        }
        this.trainSteps++;
        return this.trainLoss;
    }
    encodeSequence(txArray) { return txArray.map(t => t === 'T' ? [1, 0] : [0, 1]); }

    trainOnHistory(historyRecords, epochs = 2) {
        const samples = [];
        const tx = historyRecords.map(h => h.tx);

        for (let winLen = 5; winLen <= 15; winLen++) {
            for (let i = 0; i <= tx.length - winLen - 1; i++) {
                const patternStr = tx.slice(i, i + winLen).join('');
                const nextResult = tx[i + winLen];
                samples.push({
                    pattern: patternStr,
                    next: nextResult === 'T' ? 't' : 'x'
                });
            }
        }

        if (samples.length === 0) {
            console.log('⚠️ Không đủ data để train LSTM');
            return;
        }

        console.log(`🧠 LSTM training: ${samples.length} samples × ${epochs} epoch...`);
        const startTime = Date.now();
        let totalLoss = 0, correct = 0, count = 0;

        for (let epoch = 0; epoch < epochs; epoch++) {
            for (const { pattern, next } of samples) {
                const txArray = pattern.split('');
                const sequence = this.encodeSequence(txArray);
                const targetIdx = next === 't' ? 0 : 1;
                const loss = this.trainStep(sequence, targetIdx);
                totalLoss += loss;
                const pred = this.forwardSequence(sequence);
                const predIdx = pred.probs[0] > pred.probs[1] ? 0 : 1;
                if (predIdx === targetIdx) correct++;
                count++;
            }
            console.log(`   Epoch ${epoch + 1}/${epochs}: loss=${(totalLoss/count).toFixed(4)} acc=${(correct/count*100).toFixed(1)}%`);
            this.lastAccuracy = correct / count;
            totalLoss = 0; correct = 0; count = 0;
        }
        console.log(`✅ LSTM trained in ${((Date.now() - startTime)/1000).toFixed(2)}s`);
    }

    predict(historyTx) {
        if (historyTx.length < 5) return null;
        const recent = historyTx.slice(-20);
        const sequence = this.encodeSequence(recent);
        const result = this.forwardSequence(sequence);
        return {
            probs: result.probs,
            prediction: result.probs[0] > result.probs[1] ? 'T' : 'X',
            confidence: Math.max(result.probs[0], result.probs[1])
        };
    }
    resetState() {
        this.h = new Array(this.hiddenSize).fill(0);
        this.c = new Array(this.hiddenSize).fill(0);
    }
}
/**
 * =====================================================================
 * SUNWIN API SERVER v5.0 - PHẦN 4/5
 * AI CORE CLASS + FETCH API + POLLING LOOP
 * =====================================================================
 */

class AdvancedDeepLearningAI {
    constructor() {
        this.history = [];
        this.algorithmWeights = {};
        this.algorithmPerformance = {};
        this.recentPredictions = {};
        this.lstmInitialized = false;
        ALGORITHMS.forEach(algo => {
            this.algorithmWeights[algo.id] = 1.0;
            this.algorithmPerformance[algo.id] = { correct: 0, total: 0, recent: [], streak: 0, maxStreak: 0, name: algo.name };
            this.recentPredictions[algo.id] = null;
        });
    }
    updateAlgorithmPerformance(actualTx) {
        ALGORITHMS.forEach(algo => {
            const perf = this.algorithmPerformance[algo.id];
            const lastPred = this.recentPredictions[algo.id];
            if (lastPred) {
                const correct = lastPred === actualTx;
                perf.correct += correct ? 1 : 0;
                perf.total += 1;
                if (correct) { perf.streak++; perf.maxStreak = Math.max(perf.maxStreak, perf.streak); }
                else perf.streak = 0;
                perf.recent.push(correct ? 1 : 0);
                if (perf.recent.length > 10) perf.recent.shift();
                if (perf.total >= 15) {
                    const accuracy = perf.correct / perf.total;
                    const recentAccuracy = perf.recent.reduce((a, b) => a + b) / perf.recent.length;
                    const streakBonus = perf.streak * 0.03;
                    let newWeight = (accuracy * 0.6 + recentAccuracy * 0.3 + streakBonus * 0.1);
                    newWeight = Math.max(0.1, Math.min(2.0, newWeight * 1.8));
                    this.algorithmWeights[algo.id] = this.algorithmWeights[algo.id] * 0.8 + newWeight * 0.2;
                }
            }
        });
        ALGORITHMS.forEach(algo => { this.recentPredictions[algo.id] = null; });
    }
    calculateTrueConfidence(predictions) {
        if (predictions.length === 0) return 0.5;
        const votes = { T: 0, X: 0 };
        let totalWeight = 0;
        predictions.forEach(pred => {
            const weight = this.algorithmWeights[pred.algorithm] || 1.0;
            votes[pred.prediction] += weight;
            totalWeight += weight;
        });
        if (totalWeight === 0) return 0.5;
        const tVotes = votes['T'] || 0;
        const xVotes = votes['X'] || 0;
        const winningPrediction = tVotes > xVotes ? 'T' : (xVotes > tVotes ? 'X' : null);
        if (!winningPrediction) return 0.5;
        let confidence = Math.max(tVotes, xVotes) / totalWeight;
        const consensus = predictions.filter(p => p.prediction === winningPrediction).length / predictions.length;
        confidence = (confidence * 0.7) + (consensus * 0.3);
        return Math.max(0.5, Math.min(0.98, confidence));
    }
    predict() {
        if (this.history.length < 15) return { prediction: 'tài', confidence: 0.5, rawPrediction: 'T', algorithms: 0 };
        const predictions = [];
        this.recentPredictions = {};
        ALGORITHMS.forEach(algo => {
            try {
                const pred = algo.fn(this.history);
                if (pred === 'T' || pred === 'X') {
                    const weight = this.algorithmWeights[algo.id] || 1.0;
                    predictions.push({ algorithm: algo.id, prediction: pred, weight });
                    this.recentPredictions[algo.id] = pred;
                }
            } catch (e) { console.error(`Lỗi thuật toán ${algo.id}:`, e.message); }
        });
        if (predictions.length === 0) return { prediction: 'tài', confidence: 0.5, rawPrediction: 'T', algorithms: 0 };
        const votes = { T: 0, X: 0 };
        predictions.forEach(p => { votes[p.prediction] += p.weight; });
        const tVotes = votes['T'] || 0;
        const xVotes = votes['X'] || 0;
        let finalPrediction = 'T';
        if (xVotes > tVotes) finalPrediction = 'X';
        else if (xVotes === tVotes) finalPrediction = this.history[this.history.length - 1].tx;
        const confidence = this.calculateTrueConfidence(predictions);
        return {
            prediction: finalPrediction === 'T' ? 'tài' : 'xỉu',
            confidence, rawPrediction: finalPrediction, algorithms: predictions.length
        };
    }
    addResult(record) {
        const parsed = {
            session: Number(record.session) || 0,
            dice: Array.isArray(record.dice) ? record.dice : [],
            total: Number(record.total) || 0,
            result: record.result || '',
            tx: (Number(record.total) || 0) >= 11 ? 'T' : 'X'
        };
        if (this.history.length >= 15) this.updateAlgorithmPerformance(parsed.tx);
        this.history.push(parsed);
        if (this.history.length > 500) this.history = this.history.slice(-400);
        return parsed;
    }
    loadHistory(historyData) {
        this.history = parseLines(historyData);

        if (this.history.length >= 30) {
            console.log(`🤖 Huấn luyện AI trên ${this.history.length} mẫu thực...`);

            const loaded = dataset.loadFromHistory(this.history);
            if (loaded) {
                console.log(`✅ Dataset tự học thành công (${dataset.totalSamples} mẫu)`);
            }

            if (!this.lstmInitialized && this.history.length >= 50) {
                lstmModel = new LSTMLikeModel(16, 0.008);
                setTimeout(() => {
                    try {
                        lstmModel.trainOnHistory(this.history, 2);
                        this.lstmInitialized = true;
                    } catch (e) {
                        console.error('❌ LSTM training lỗi:', e.message);
                    }
                }, 100);
            }

            for (let i = 20; i < this.history.length - 1; i++) {
                const pastHistory = this.history.slice(0, i + 1);
                const actualTx = this.history[i + 1]?.tx;
                if (!actualTx) continue;
                ALGORITHMS.forEach(algo => {
                    try {
                        const pred = algo.fn(pastHistory);
                        if (pred) {
                            const perf = this.algorithmPerformance[algo.id];
                            const correct = pred === actualTx;
                            perf.recent.push(correct ? 1 : 0);
                            if (perf.recent.length > 10) perf.recent.shift();
                            perf.correct += correct ? 1 : 0;
                            perf.total++;
                            if (perf.total >= 15) {
                                const accuracy = perf.correct / perf.total;
                                const recentAccuracy = perf.recent.reduce((a, b) => a + b, 0) / perf.recent.length;
                                let newWeight = (accuracy * 0.6 + recentAccuracy * 0.3);
                                newWeight = Math.max(0.1, Math.min(2.5, newWeight * 2));
                                this.algorithmWeights[algo.id] = this.algorithmWeights[algo.id] * 0.7 + newWeight * 0.3;
                            }
                        }
                    } catch (e) {}
                });
            }
            console.log('✅ Fine-tuning xong!');
        }
    }
    getPattern() {
        if (this.history.length < 50) return { recent: 'đang thu thập...', long: 'đang thu thập...', discovered: 'đang thu thập...' };
        const tx = this.history.map(h => h.tx);
        return {
            recent: tx.slice(-20).join('').toLowerCase(),
            long: tx.slice(-50).join('').toLowerCase(),
            discovered: this.discoverDominantPattern(tx.slice(-30))
        };
    }
    discoverDominantPattern(txArray) {
        const str = txArray.join('').toLowerCase();
        let dominantPattern = null, maxOccurrences = 0;
        Object.entries(PATTERN_DATABASE).forEach(([name, patterns]) => {
            patterns.forEach(pattern => {
                let count = 0;
                for (let i = 0; i <= str.length - pattern.length; i++) {
                    if (str.substr(i, pattern.length) === pattern) count++;
                }
                if (count > maxOccurrences) { maxOccurrences = count; dominantPattern = name; }
            });
        });
        return dominantPattern || 'không xác định';
    }
    getStats() {
        const stats = {};
        ALGORITHMS.forEach(algo => {
            const perf = this.algorithmPerformance[algo.id];
            if (perf.total > 0) {
                stats[algo.id] = {
                    name: perf.name,
                    accuracy: (perf.correct / perf.total * 100).toFixed(1) + '%',
                    weight: this.algorithmWeights[algo.id].toFixed(2),
                    predictions: perf.total,
                    streak: perf.streak
                };
            }
        });
        return stats;
    }
}

const ai = new AdvancedDeepLearningAI();

// ============================================================
// FETCH HISTORY FROM API
// ============================================================
async function fetchHistoryFromAPI() {
    try {
        const response = await fetch(HISTORY_API, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; SunwinAI/12.0)',
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            console.error(`❌ API trả về ${response.status}`);
            return null;
        }

        const json = await response.json();
        if (!json.data || !Array.isArray(json.data)) {
            console.error('❌ API data không hợp lệ');
            return null;
        }

        const newHistory = json.data.map((item) => ({
            session: item['phiên'],
            dice: [item.d1, item.d2, item.d3],
            total: item['tổng'],
            result: item['kết quả'],
        })).sort((a, b) => a.session - b.session);

        return newHistory;
    } catch (e) {
        console.error('❌ Lỗi fetch API:', e.message);
        return null;
    }
}

// ============================================================
// POLLING LOOP
// ============================================================
async function pollHistory() {
    const newHistory = await fetchHistoryFromAPI();
    if (!newHistory || newHistory.length === 0) return;

    const latestSession = newHistory[newHistory.length - 1].session;

    if (!rikCurrentSession || latestSession > rikCurrentSession) {
        const isFirstLoad = rikCurrentSession === null;

        ai.loadHistory(newHistory);
        rikResults = newHistory.slice(-50).sort((a, b) => b.session - a.session);
        rikCurrentSession = latestSession;

        const prediction = ai.predict();

        if (isFirstLoad) {
            console.log(`\n==============================================`);
            console.log(`📊 Đã tải ${newHistory.length} kết quả lịch sử`);
            console.log(`🤖 @cskhgiabao AI ĐÃ SẴN SÀNG`);
            console.log(`🎯 Confidence: ${(prediction.confidence * 100).toFixed(1)}%`);
            console.log(`==============================================`);
        } else {
            const latest = newHistory[newHistory.length - 1];
            console.log(`\n==============================================`);
            console.log(`📥 PHIÊN ${latest.session}: ${latest.result} (${latest.total})`);
            console.log(`🔮 DỰ ĐOÁN ${latest.session + 1}: **${prediction.prediction.toUpperCase()}**`);
            console.log(`🎯 CONFIDENCE: ${(prediction.confidence * 100).toFixed(1)}%`);
            console.log(`🤖 ALGORITHMS: ${prediction.algorithms}/${ALGORITHMS.length}`);
        }
    }
}
/**
 * =====================================================================
 * SUNWIN API SERVER v5.0 - PHẦN 5/5
 * API ENDPOINTS + START SERVER
 * =====================================================================
 */

// ============================================================
// BUILD PREDICTION PAYLOAD
// ============================================================
function buildPredictionPayload() {
    const valid = rikResults.filter((r) => r.dice?.length === 3);
    const lastResult = valid.length ? valid[0] : null;
    const currentPrediction = ai.predict();

    if (!lastResult) {
        return {
            id: '@cskhgiabao',
            phien_truoc: null,
            xuc_xac: null,
            ket_qua: null,
            phien_nay: null,
            du_doan: null,
            do_tin_cay: '0%',
            success: false,
            status: "đang chờ dữ liệu phiên đầu tiên...",
            timestamp: Date.now()
        };
    }

    return {
        id: '@cskhgiabao',
        phien_truoc: lastResult.session,
        xuc_xac: lastResult.dice,
        ket_qua: lastResult.result.toLowerCase(),
        phien_nay: lastResult.session + 1,
        du_doan: currentPrediction.prediction,
        do_tin_cay: `${(currentPrediction.confidence * 100).toFixed(1)}%`,
        success: true,
        status: "online",
        algorithms_active: currentPrediction.algorithms,
        total_algorithms: ALGORITHMS.length,
        timestamp: Date.now()
    };
}

// ============================================================
// API ENDPOINTS
// ============================================================

// GET /api/sunwin/tx - Endpoint chính
app.get('/api/sunwin/tx', async (req, res) => {
    try {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.json(buildPredictionPayload());
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/sunwin/tx/only
app.get('/api/sunwin/tx/only', async (req, res) => {
    try {
        const valid = rikResults.filter((r) => r.dice?.length === 3);
        const lastResult = valid.length ? valid[0] : null;
        const currentPrediction = ai.predict();
        if (!lastResult) return res.json({ success: false, du_doan: null, phien: null });
        res.json({
            id: '@cskhgiabao',
            success: true,
            phien: lastResult.session + 1,
            phien_truoc: lastResult.session,
            ket_qua_truoc: lastResult.result.toLowerCase(),
            du_doan: currentPrediction.prediction,
            do_tin_cay: `${(currentPrediction.confidence * 100).toFixed(1)}%`,
            confidence_raw: currentPrediction.confidence,
            algorithms: currentPrediction.algorithms
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/sunwin/tx/history
app.get('/api/sunwin/tx/history', async (req, res) => {
    try {
        const valid = rikResults.filter((r) => r.dice?.length === 3);
        if (!valid.length) return res.json({ success: false, history: [] });
        res.json({
            success: true,
            total: valid.length,
            history: valid.slice(0, 30).map((i) => ({
                phien: i.session,
                xuc_xac: i.dice,
                tong: i.total,
                ket_qua: i.result.toLowerCase(),
                tx: i.total >= 11 ? 'T' : 'X'
            }))
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// GET /api/taixiu/ai-stats
app.get('/api/taixiu/ai-stats', async (req, res) => {
    try {
        res.json({
            status: "online",
            ai_version: "12.0 - @cskhgiabao Self-Learning Version",
            dataset_info: {
                total_samples: dataset.totalSamples,
                loaded: dataset.totalSamples > 0,
                source: "self-learned from API history"
            },
            lstm_info: lstmModel ? {
                enabled: true,
                hidden_size: lstmModel.hiddenSize,
                train_steps: lstmModel.trainSteps,
                train_accuracy: `${(lstmModel.lastAccuracy * 100).toFixed(1)}%`
            } : { enabled: false },
            current_prediction: ai.predict(),
            pattern_dominant: ai.getPattern().discovered,
            algorithm_stats: ai.getStats()
        });
    } catch (e) { res.json({ error: "Lỗi hệ thống" }); }
});

// GET / - Root
app.get('/', async (req, res) => {
    res.json({
        status: "online",
        name: "@cskhgiabao Sunwin AI",
        version: "12.0 - Self-Learning Version",
        data_source: HISTORY_API,
        algorithms_count: ALGORITHMS.length,
        pattern_database: Object.keys(PATTERN_DATABASE).length + " mẫu cầu",
        dataset_samples: dataset.totalSamples,
        note: "Dataset tự học từ history - không cần file",
        endpoints: {
            rest: [
                "GET /api/sunwin/tx",
                "GET /api/sunwin/tx/only",
                "GET /api/sunwin/tx/history",
                "GET /api/taixiu/ai-stats"
            ]
        }
    });
});

// ============================================================
// START SERVER
// ============================================================
const start = async () => {
    try {
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`\n==============================================`);
            console.log(`🚀 @cskhgiabao Sunwin AI v12.0`);
            console.log(`==============================================`);
            console.log(`   Port: ${PORT}`);
            console.log(`   Thuật toán: ${ALGORITHMS.length} AI Algorithms`);
            console.log(`   Pattern Database: ${Object.keys(PATTERN_DATABASE).length} mẫu`);
            console.log(`   Dataset: Self-learning (không cần file)`);
            console.log(`   Data Source: kwinstore.com`);
            console.log(`   Poll Interval: ${POLL_INTERVAL}ms`);
            console.log(`==============================================\n`);
        });

        await pollHistory();
        pollInterval = setInterval(pollHistory, POLL_INTERVAL);
        console.log(`✅ Bắt đầu polling API mỗi ${POLL_INTERVAL}ms\n`);
    } catch (err) {
        console.error('❌ Lỗi khởi động server:', err);
        process.exit(1);
    }
};

process.on('SIGINT', () => {
    console.log('\n🛑 Đang dừng server...');
    clearInterval(pollInterval);
    process.exit(0);
});

start();
