const audioFileInput = document.getElementById("audioFile");
const audioPlayer = document.getElementById("audioPlayer");
const analyzeBtn = document.getElementById("analyzeBtn");

const maxAmplitudeElement = document.getElementById("maxAmplitude");
const avgAmplitudeElement = document.getElementById("avgAmplitude");
const frequencyElement = document.getElementById("frequency");
const formulaElement = document.getElementById("formula");
const similarityScoreElement = document.getElementById("similarityScore");
const similarityFillElement = document.getElementById("similarityFill");

const waveCanvas = document.getElementById("waveCanvas");
const waveCtx = waveCanvas.getContext("2d");

const functionCanvas = document.getElementById("functionCanvas");
const functionCtx = functionCanvas.getContext("2d");

const transformCanvas = document.getElementById("transformCanvas");
const transformCtx = transformCanvas.getContext("2d");

const functionTypeSelect = document.getElementById("functionType");
const amplitudeSlider = document.getElementById("amplitudeSlider");
const frequencySlider = document.getElementById("frequencySlider");
const amplitudeValue = document.getElementById("amplitudeValue");
const frequencyValue = document.getElementById("frequencyValue");

const animateBtn = document.getElementById("animateBtn");
const resetBtn = document.getElementById("resetBtn");
const exportBtn = document.getElementById("exportBtn");

let selectedAudioFile = null;
let generatedAudioBuffer = null;
let lastAudioData = null;

let currentAmplitude = 0.5;
let currentFrequency = 100;

let originalAmplitude = 0.5;
let originalFrequency = 100;

let isAnimating = false;
let animationFrameId = null;
let animationPhase = 0;

let currentTransformMode = "original";

audioFileInput.addEventListener("change", function () {
    selectedAudioFile = this.files[0];
    generatedAudioBuffer = null;

    if (!selectedAudioFile) {
        alert("Súbor nebol vybraný.");
        return;
    }

    const audioURL = URL.createObjectURL(selectedAudioFile);
    audioPlayer.src = audioURL;
});

document.querySelectorAll(".preset-btn").forEach(function (button) {
    button.addEventListener("click", function () {
        const type = button.dataset.type;
        const frequency = parseFloat(button.dataset.frequency);

        generatedAudioBuffer = generatePresetAudio(type, frequency);
        selectedAudioFile = null;
        audioFileInput.value = "";

        const wavBlob = audioBufferToWavBlob(generatedAudioBuffer);
        audioPlayer.src = URL.createObjectURL(wavBlob);

        currentFrequency = frequency;
        frequencySlider.value = frequency;
        frequencyValue.textContent = frequency.toFixed(2) + " Hz";

        if (type === "combined") {
            functionTypeSelect.value = "combined";
        } else {
            functionTypeSelect.value = "sin";
        }
    });
});

analyzeBtn.addEventListener("click", async function () {
    try {
        analyzeBtn.disabled = true;
        analyzeBtn.textContent = "Analyzujem...";

        let audioBuffer;

        if (generatedAudioBuffer) {
            audioBuffer = generatedAudioBuffer;
        } else if (selectedAudioFile) {
            const arrayBuffer = await selectedAudioFile.arrayBuffer();
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            const audioContext = new AudioContextClass();

            if (audioContext.state === "suspended") {
                await audioContext.resume();
            }

            audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
        } else {
            alert("Najprv nahraj audio súbor alebo vygeneruj preset audio.");
            return;
        }

        const channelData = audioBuffer.getChannelData(0);
        const sampleRate = audioBuffer.sampleRate;

        lastAudioData = channelData;

        const maxAmplitude = calculateMaxAmplitude(channelData);
        const avgAmplitude = calculateAverageAmplitude(channelData);
        const dominantFrequency = estimateDominantFrequency(channelData, sampleRate);

        currentAmplitude = maxAmplitude;
        currentFrequency = Math.min(dominantFrequency, 1000);

        originalAmplitude = currentAmplitude;
        originalFrequency = currentFrequency;

        maxAmplitudeElement.textContent = maxAmplitude.toFixed(3);
        avgAmplitudeElement.textContent = avgAmplitude.toFixed(3);
        frequencyElement.textContent = dominantFrequency.toFixed(2);

        amplitudeSlider.value = currentAmplitude;
        frequencySlider.value = currentFrequency;

        amplitudeValue.textContent = currentAmplitude.toFixed(2);
        frequencyValue.textContent = currentFrequency.toFixed(2) + " Hz";

        updateFormulaText(currentAmplitude, currentFrequency);

        drawMathFunction(currentAmplitude, currentFrequency, animationPhase);
        drawComparisonGraph();
        drawTransformationGraph();
        updateSimilarityScore();

    } catch (error) {
        console.error("Chyba pri analýze:", error);
        alert("Nepodarilo sa analyzovať audio. Skús iný MP3/WAV súbor alebo preset audio.");
    } finally {
        analyzeBtn.disabled = false;
        analyzeBtn.textContent = "Analyzovať zvuk";
    }
});

function generatePresetAudio(type, frequency) {
    const sampleRate = 44100;
    const duration = 2;
    const length = sampleRate * duration;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const audioContext = new AudioContextClass();
    const buffer = audioContext.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i++) {
        const t = i / sampleRate;

        if (type === "combined") {
            data[i] =
                0.65 * Math.sin(2 * Math.PI * frequency * t) +
                0.35 * Math.cos(2 * Math.PI * frequency * 2 * t);
        } else {
            data[i] = 0.85 * Math.sin(2 * Math.PI * frequency * t);
        }
    }

    return buffer;
}

function audioBufferToWavBlob(audioBuffer) {
    const numChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const samples = audioBuffer.length;

    const buffer = new ArrayBuffer(44 + samples * numChannels * 2);
    const view = new DataView(buffer);

    writeString(view, 0, "RIFF");
    view.setUint32(4, 36 + samples * numChannels * 2, true);
    writeString(view, 8, "WAVE");
    writeString(view, 12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * 2, true);
    view.setUint16(32, numChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, "data");
    view.setUint32(40, samples * numChannels * 2, true);

    let offset = 44;

    for (let i = 0; i < samples; i++) {
        for (let channel = 0; channel < numChannels; channel++) {
            const channelData = audioBuffer.getChannelData(channel);
            const sample = Math.max(-1, Math.min(1, channelData[i]));
            view.setInt16(offset, sample * 0x7fff, true);
            offset += 2;
        }
    }

    return new Blob([view], { type: "audio/wav" });
}

function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

function calculateMaxAmplitude(data) {
    let max = 0;

    for (let i = 0; i < data.length; i++) {
        const value = Math.abs(data[i]);

        if (value > max) {
            max = value;
        }
    }

    return max;
}

function calculateAverageAmplitude(data) {
    let sum = 0;

    for (let i = 0; i < data.length; i++) {
        sum += Math.abs(data[i]);
    }

    return sum / data.length;
}

function estimateDominantFrequency(data, sampleRate) {
    let zeroCrossings = 0;

    for (let i = 1; i < data.length; i++) {
        if ((data[i - 1] < 0 && data[i] >= 0) || (data[i - 1] > 0 && data[i] <= 0)) {
            zeroCrossings++;
        }
    }

    const duration = data.length / sampleRate;
    return zeroCrossings / (2 * duration);
}

function getFunctionValue(type, amplitude, visualFrequency, t, phase) {
    if (type === "sin") {
        return amplitude * Math.sin(2 * Math.PI * visualFrequency * t + phase);
    }

    if (type === "cos") {
        return amplitude * Math.cos(2 * Math.PI * visualFrequency * t + phase);
    }

    return (
        amplitude * Math.sin(2 * Math.PI * visualFrequency * t + phase) +
        (amplitude / 2) * Math.cos(2 * Math.PI * visualFrequency * 2 * t + phase)
    );
}

function drawMathFunction(amplitude, frequency, phase = 0) {
    functionCtx.clearRect(0, 0, functionCanvas.width, functionCanvas.height);

    functionCtx.fillStyle = "#111827";
    functionCtx.fillRect(0, 0, functionCanvas.width, functionCanvas.height);

    drawGraphGrid(functionCtx, functionCanvas, "f(t)");

    const originX = 55;
    const originY = functionCanvas.height / 2;
    const graphWidth = functionCanvas.width - 85;
    const scaleY = 68;

    functionCtx.strokeStyle = "#22c55e";
    functionCtx.lineWidth = 2;
    functionCtx.beginPath();

    const visualFrequency = Math.max(1, Math.min(frequency / 50, 20));
    const functionType = functionTypeSelect.value;

    for (let pixel = 0; pixel <= graphWidth; pixel++) {
        const xValue = (pixel / graphWidth) * 10;
        const t = xValue / 10;

        const value = getFunctionValue(functionType, amplitude, visualFrequency, t, phase);

        const canvasX = originX + pixel;
        const canvasY = originY - value * scaleY;

        if (pixel === 0) {
            functionCtx.moveTo(canvasX, canvasY);
        } else {
            functionCtx.lineTo(canvasX, canvasY);
        }
    }

    functionCtx.stroke();

    drawFunctionPoints(amplitude, frequency, phase);
    updateFormulaText(amplitude, frequency);
}

function drawGraphGrid(ctx, canvas, title) {
    const originX = 55;
    const originY = canvas.height / 2;
    const graphWidth = canvas.width - 85;
    const graphHeight = canvas.height - 45;

    ctx.save();

    ctx.strokeStyle = "#243244";
    ctx.lineWidth = 1;

    for (let x = originX; x <= originX + graphWidth; x += graphWidth / 10) {
        ctx.beginPath();
        ctx.moveTo(x, 18);
        ctx.lineTo(x, canvas.height - 28);
        ctx.stroke();
    }

    for (let y = 18; y <= canvas.height - 28; y += graphHeight / 8) {
        ctx.beginPath();
        ctx.moveTo(originX, y);
        ctx.lineTo(originX + graphWidth, y);
        ctx.stroke();
    }

    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(originX, originY);
    ctx.lineTo(originX + graphWidth, originY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(originX, 18);
    ctx.lineTo(originX, canvas.height - 28);
    ctx.stroke();

    ctx.fillStyle = "#e5e7eb";
    ctx.font = "12px Arial";
    ctx.textAlign = "center";

    for (let i = 0; i <= 10; i++) {
        const x = originX + (graphWidth / 10) * i;

        ctx.fillText(i.toString(), x, originY + 20);

        ctx.beginPath();
        ctx.moveTo(x, originY - 4);
        ctx.lineTo(x, originY + 4);
        ctx.stroke();
    }

    ctx.textAlign = "right";
    ctx.fillText("1", originX - 8, originY - 64);
    ctx.fillText("0", originX - 8, originY + 4);
    ctx.fillText("-1", originX - 8, originY + 70);

    ctx.textAlign = "center";
    ctx.fillText("x / t", originX + graphWidth / 2, canvas.height - 8);

    ctx.save();
    ctx.translate(17, originY);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("y / f(t)", 0, 0);
    ctx.restore();

    ctx.textAlign = "left";
    ctx.fillText(title, originX, 14);

    ctx.restore();
}

function drawFunctionPoints(amplitude, frequency, phase = 0) {
    const originX = 55;
    const originY = functionCanvas.height / 2;
    const graphWidth = functionCanvas.width - 85;
    const scaleY = 68;

    const visualFrequency = Math.max(1, Math.min(frequency / 50, 20));
    const functionType = functionTypeSelect.value;

    functionCtx.fillStyle = "#facc15";
    functionCtx.strokeStyle = "#111827";
    functionCtx.lineWidth = 2;
    functionCtx.font = "11px Arial";
    functionCtx.textAlign = "center";

    for (let i = 0; i <= 10; i++) {
        const t = i / 10;
        const value = getFunctionValue(functionType, amplitude, visualFrequency, t, phase);

        const x = originX + (graphWidth / 10) * i;
        const y = originY - value * scaleY;

        functionCtx.beginPath();
        functionCtx.arc(x, y, 4, 0, Math.PI * 2);
        functionCtx.fill();
        functionCtx.stroke();

        functionCtx.fillStyle = "#f9fafb";
        functionCtx.fillText(`(${i}, ${value.toFixed(2)})`, x, y - 8);
        functionCtx.fillStyle = "#facc15";
    }
}

function drawComparisonGraph() {
    waveCtx.clearRect(0, 0, waveCanvas.width, waveCanvas.height);

    const width = waveCanvas.width;
    const height = waveCanvas.height;

    const originX = 55;
    const originY = height / 2;
    const graphWidth = width - 85;
    const scaleY = 50;

    waveCtx.fillStyle = "#111827";
    waveCtx.fillRect(0, 0, width, height);

    waveCtx.strokeStyle = "#243244";
    waveCtx.lineWidth = 1;

    for (let x = originX; x <= originX + graphWidth; x += graphWidth / 10) {
        waveCtx.beginPath();
        waveCtx.moveTo(x, 18);
        waveCtx.lineTo(x, height - 28);
        waveCtx.stroke();
    }

    for (let y = 20; y <= height - 28; y += 30) {
        waveCtx.beginPath();
        waveCtx.moveTo(originX, y);
        waveCtx.lineTo(originX + graphWidth, y);
        waveCtx.stroke();
    }

    waveCtx.strokeStyle = "#e5e7eb";
    waveCtx.lineWidth = 2;

    waveCtx.beginPath();
    waveCtx.moveTo(originX, originY);
    waveCtx.lineTo(originX + graphWidth, originY);
    waveCtx.stroke();

    waveCtx.beginPath();
    waveCtx.moveTo(originX, 18);
    waveCtx.lineTo(originX, height - 28);
    waveCtx.stroke();

    waveCtx.fillStyle = "#e5e7eb";
    waveCtx.font = "12px Arial";
    waveCtx.textAlign = "center";

    for (let i = 0; i <= 10; i++) {
        const x = originX + (graphWidth / 10) * i;
        waveCtx.fillText(i.toString(), x, originY + 20);
    }

    waveCtx.textAlign = "right";
    waveCtx.fillText("1", originX - 8, originY - 50);
    waveCtx.fillText("0", originX - 8, originY + 4);
    waveCtx.fillText("-1", originX - 8, originY + 56);

    waveCtx.textAlign = "left";
    waveCtx.fillText("Sin vs Cos vs Combined", originX, 14);

    waveCtx.fillStyle = "#38bdf8";
    waveCtx.fillRect(width - 310, 12, 12, 12);
    waveCtx.fillStyle = "#e5e7eb";
    waveCtx.fillText("Sin", width - 292, 23);

    waveCtx.fillStyle = "#f97316";
    waveCtx.fillRect(width - 240, 12, 12, 12);
    waveCtx.fillStyle = "#e5e7eb";
    waveCtx.fillText("Cos", width - 222, 23);

    waveCtx.fillStyle = "#22c55e";
    waveCtx.fillRect(width - 165, 12, 12, 12);
    waveCtx.fillStyle = "#e5e7eb";
    waveCtx.fillText("Combined", width - 147, 23);

    const visualFrequency = Math.max(1, Math.min(currentFrequency / 50, 20));

    drawComparisonLine("sin", "#38bdf8", 2, visualFrequency, scaleY);
    drawComparisonLine("cos", "#f97316", 2, visualFrequency, scaleY);
    drawComparisonLine("combined", "#22c55e", 2.4, visualFrequency, scaleY);

    waveCtx.fillStyle = "#cbd5e1";
    waveCtx.font = "12px Arial";
    waveCtx.textAlign = "center";
    waveCtx.fillText("čas / t", originX + graphWidth / 2, height - 8);

    waveCtx.save();
    waveCtx.translate(17, originY);
    waveCtx.rotate(-Math.PI / 2);
    waveCtx.fillText("amplitúda", 0, 0);
    waveCtx.restore();
}

function drawComparisonLine(type, color, lineWidth, visualFrequency, scaleY) {
    const width = waveCanvas.width;
    const height = waveCanvas.height;

    const originX = 55;
    const originY = height / 2;
    const graphWidth = width - 85;

    waveCtx.strokeStyle = color;
    waveCtx.lineWidth = lineWidth;
    waveCtx.beginPath();

    for (let x = 0; x < graphWidth; x++) {
        const t = x / graphWidth;
        const value = getFunctionValue(type, currentAmplitude, visualFrequency, t, animationPhase);

        const canvasX = originX + x;
        const canvasY = originY - value * scaleY;

        if (x === 0) {
            waveCtx.moveTo(canvasX, canvasY);
        } else {
            waveCtx.lineTo(canvasX, canvasY);
        }
    }

    waveCtx.stroke();
}

function drawTransformationGraph() {
    transformCtx.clearRect(0, 0, transformCanvas.width, transformCanvas.height);

    const width = transformCanvas.width;
    const height = transformCanvas.height;

    const originX = 55;
    const originY = height / 2;
    const graphWidth = width - 85;
    const scaleY = 48;

    transformCtx.fillStyle = "#111827";
    transformCtx.fillRect(0, 0, width, height);

    drawTransformGrid(originX, originY, graphWidth, height);

    const visualFrequency = Math.max(1, Math.min(currentFrequency / 50, 20));

    drawTransformLine("original", "#38bdf8", 1.6, visualFrequency, scaleY, true);
    drawTransformLine(currentTransformMode, "#22c55e", 2.5, visualFrequency, scaleY, false);

    transformCtx.fillStyle = "#e5e7eb";
    transformCtx.font = "12px Arial";
    transformCtx.textAlign = "left";
    transformCtx.fillText(getTransformTitle(currentTransformMode), originX, 14);

    transformCtx.fillStyle = "#38bdf8";
    transformCtx.fillRect(width - 250, 12, 12, 12);
    transformCtx.fillStyle = "#e5e7eb";
    transformCtx.fillText("Original", width - 233, 23);

    transformCtx.fillStyle = "#22c55e";
    transformCtx.fillRect(width - 150, 12, 12, 12);
    transformCtx.fillStyle = "#e5e7eb";
    transformCtx.fillText("Transformácia", width - 133, 23);
}

function drawTransformGrid(originX, originY, graphWidth, height) {
    transformCtx.strokeStyle = "#243244";
    transformCtx.lineWidth = 1;

    for (let x = originX; x <= originX + graphWidth; x += graphWidth / 10) {
        transformCtx.beginPath();
        transformCtx.moveTo(x, 18);
        transformCtx.lineTo(x, height - 28);
        transformCtx.stroke();
    }

    for (let y = 20; y <= height - 28; y += 30) {
        transformCtx.beginPath();
        transformCtx.moveTo(originX, y);
        transformCtx.lineTo(originX + graphWidth, y);
        transformCtx.stroke();
    }

    transformCtx.strokeStyle = "#e5e7eb";
    transformCtx.lineWidth = 2;

    transformCtx.beginPath();
    transformCtx.moveTo(originX, originY);
    transformCtx.lineTo(originX + graphWidth, originY);
    transformCtx.stroke();

    transformCtx.beginPath();
    transformCtx.moveTo(originX, 18);
    transformCtx.lineTo(originX, height - 28);
    transformCtx.stroke();

    transformCtx.fillStyle = "#e5e7eb";
    transformCtx.font = "12px Arial";
    transformCtx.textAlign = "center";

    for (let i = 0; i <= 10; i++) {
        const x = originX + (graphWidth / 10) * i;
        transformCtx.fillText(i.toString(), x, originY + 20);
    }

    transformCtx.textAlign = "right";
    transformCtx.fillText("1", originX - 8, originY - 48);
    transformCtx.fillText("0", originX - 8, originY + 4);
    transformCtx.fillText("-1", originX - 8, originY + 54);

    transformCtx.textAlign = "center";
    transformCtx.fillText("čas / t", originX + graphWidth / 2, height - 8);

    transformCtx.save();
    transformCtx.translate(17, originY);
    transformCtx.rotate(-Math.PI / 2);
    transformCtx.fillText("amplitúda", 0, 0);
    transformCtx.restore();
}

function drawTransformLine(mode, color, lineWidth, visualFrequency, scaleY, isReference) {
    const width = transformCanvas.width;
    const height = transformCanvas.height;

    const originX = 55;
    const originY = height / 2;
    const graphWidth = width - 85;

    transformCtx.strokeStyle = color;
    transformCtx.lineWidth = lineWidth;
    transformCtx.globalAlpha = isReference ? 0.45 : 1;

    transformCtx.beginPath();

    for (let x = 0; x < graphWidth; x++) {
        const t = x / graphWidth;
        const value = getTransformedValue(mode, visualFrequency, t, animationPhase);

        const canvasX = originX + x;
        const canvasY = originY - value * scaleY;

        if (x === 0) {
            transformCtx.moveTo(canvasX, canvasY);
        } else {
            transformCtx.lineTo(canvasX, canvasY);
        }
    }

    transformCtx.stroke();
    transformCtx.globalAlpha = 1;
}

function getTransformedValue(mode, visualFrequency, t, phase) {
    const baseType = functionTypeSelect.value;
    const base = getFunctionValue(baseType, currentAmplitude, visualFrequency, t, phase);

    if (mode === "original") {
        return base;
    }

    if (mode === "verticalShift") {
        return base + 0.35;
    }

    if (mode === "amplitudeScale") {
        return base * 1.45;
    }

    if (mode === "phaseShift") {
        return getFunctionValue(baseType, currentAmplitude, visualFrequency, t, phase + Math.PI / 3);
    }

    if (mode === "fourier") {
        return (
            currentAmplitude * Math.sin(2 * Math.PI * visualFrequency * t + phase) +
            (currentAmplitude / 2) * Math.sin(2 * Math.PI * visualFrequency * 2 * t + phase) +
            (currentAmplitude / 3) * Math.sin(2 * Math.PI * visualFrequency * 3 * t + phase)
        );
    }

    return base;
}

function getTransformTitle(mode) {
    if (mode === "original") {
        return "Transformácia: pôvodná funkcia";
    }

    if (mode === "verticalShift") {
        return "Transformácia: vertikálny posun f(t) + c";
    }

    if (mode === "amplitudeScale") {
        return "Transformácia: zmena amplitúdy a · f(t)";
    }

    if (mode === "phaseShift") {
        return "Transformácia: fázový posun f(t + φ)";
    }

    if (mode === "fourier") {
        return "Fourierovská aproximácia: súčet harmonických zložiek";
    }

    return "Transformácia funkcie";
}

function calculateSimilarityScore() {
    if (!lastAudioData) {
        return 0;
    }

    const sampleCount = 1000;
    const step = Math.max(1, Math.floor(lastAudioData.length / sampleCount));
    const visualFrequency = Math.max(1, Math.min(currentFrequency / 50, 20));
    const functionType = functionTypeSelect.value;

    let audioValues = [];
    let modelValues = [];

    for (let i = 0; i < sampleCount; i++) {
        const index = i * step;

        if (index >= lastAudioData.length) {
            break;
        }

        const t = i / sampleCount;
        const audioValue = lastAudioData[index];
        const modelValue = getFunctionValue(functionType, currentAmplitude, visualFrequency, t, animationPhase);

        audioValues.push(audioValue);
        modelValues.push(modelValue);
    }

    const audioMean = average(audioValues);
    const modelMean = average(modelValues);

    let numerator = 0;
    let audioDenominator = 0;
    let modelDenominator = 0;

    for (let i = 0; i < audioValues.length; i++) {
        const audioDiff = audioValues[i] - audioMean;
        const modelDiff = modelValues[i] - modelMean;

        numerator += audioDiff * modelDiff;
        audioDenominator += audioDiff * audioDiff;
        modelDenominator += modelDiff * modelDiff;
    }

    const denominator = Math.sqrt(audioDenominator * modelDenominator);

    if (denominator === 0) {
        return 0;
    }

    const correlation = numerator / denominator;
    const similarity = Math.max(0, correlation) * 100;

    return Math.min(100, similarity);
}

function average(values) {
    if (values.length === 0) {
        return 0;
    }

    let sum = 0;

    for (let i = 0; i < values.length; i++) {
        sum += values[i];
    }

    return sum / values.length;
}

function updateSimilarityScore() {
    const score = calculateSimilarityScore();

    similarityScoreElement.textContent = score.toFixed(1);
    similarityFillElement.style.width = score.toFixed(1) + "%";
}

function updateFormulaText(amplitude, frequency) {
    const type = functionTypeSelect.value;

    if (type === "sin") {
        formulaElement.textContent =
            `f(t) = ${amplitude.toFixed(2)} · sin(2π · ${frequency.toFixed(2)} · t)`;
    } else if (type === "cos") {
        formulaElement.textContent =
            `f(t) = ${amplitude.toFixed(2)} · cos(2π · ${frequency.toFixed(2)} · t)`;
    } else {
        formulaElement.textContent =
            `f(t) = ${amplitude.toFixed(2)} · sin(2π · ${frequency.toFixed(2)} · t) + ${(amplitude / 2).toFixed(2)} · cos(2π · ${(frequency * 2).toFixed(2)} · t)`;
    }
}

function redrawInteractiveFunction() {
    currentAmplitude = parseFloat(amplitudeSlider.value);
    currentFrequency = parseFloat(frequencySlider.value);

    amplitudeValue.textContent = currentAmplitude.toFixed(2);
    frequencyValue.textContent = currentFrequency.toFixed(2) + " Hz";

    drawMathFunction(currentAmplitude, currentFrequency, animationPhase);
    drawComparisonGraph();
    drawTransformationGraph();

    if (lastAudioData) {
        updateSimilarityScore();
    }
}

function animateFunction() {
    if (!isAnimating) {
        return;
    }

    animationPhase += 0.05;

    drawMathFunction(currentAmplitude, currentFrequency, animationPhase);
    drawComparisonGraph();
    drawTransformationGraph();

    animationFrameId = requestAnimationFrame(animateFunction);
}

document.querySelectorAll(".collapse-btn").forEach(function (button) {
    button.addEventListener("click", function () {
        const targetId = button.dataset.target;
        const targetElement = document.getElementById(targetId);

        targetElement.classList.toggle("collapsed");

        if (targetElement.classList.contains("collapsed")) {
            button.textContent = "Zobraziť";
        } else {
            button.textContent = "Skryť";
        }
    });
});

document.querySelectorAll(".transform-btn").forEach(function (button) {
    button.addEventListener("click", function () {
        document.querySelectorAll(".transform-btn").forEach(function (btn) {
            btn.classList.remove("active");
        });

        button.classList.add("active");
        currentTransformMode = button.dataset.transform;

        drawTransformationGraph();
    });
});

amplitudeSlider.addEventListener("input", function () {
    redrawInteractiveFunction();
});

frequencySlider.addEventListener("input", function () {
    redrawInteractiveFunction();
});

functionTypeSelect.addEventListener("change", function () {
    redrawInteractiveFunction();
});

animateBtn.addEventListener("click", function () {
    isAnimating = !isAnimating;

    if (isAnimating) {
        animateBtn.textContent = "Zastaviť animáciu";
        animateFunction();
    } else {
        animateBtn.textContent = "Spustiť animáciu";
        cancelAnimationFrame(animationFrameId);
    }
});

resetBtn.addEventListener("click", function () {
    currentAmplitude = originalAmplitude;
    currentFrequency = originalFrequency;

    amplitudeSlider.value = currentAmplitude;
    frequencySlider.value = currentFrequency;

    amplitudeValue.textContent = currentAmplitude.toFixed(2);
    frequencyValue.textContent = currentFrequency.toFixed(2) + " Hz";

    drawMathFunction(currentAmplitude, currentFrequency, animationPhase);
    drawComparisonGraph();
    drawTransformationGraph();

    if (lastAudioData) {
        updateSimilarityScore();
    }
});

exportBtn.addEventListener("click", function () {
    const imageURL = functionCanvas.toDataURL("image/png");

    const link = document.createElement("a");
    link.href = imageURL;
    link.download = "wave2function-graph.png";
    link.click();
});

drawMathFunction(currentAmplitude, currentFrequency, 0);
drawComparisonGraph();
drawTransformationGraph();