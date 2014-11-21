'use strict'

var sylvester = require('sylvester');
var Matrix = sylvester.Matrix;

var LABELING_LENGTH = 2;
var labelingSet = ['U', 'P'];

function gridentAscent (initialTheta, alpha, MaxIter) {
	if (!MaxIter) {
		return initialTheta;
	}

	var jThetaHistory = [];
	var tmpTheta;
	var i;
	var j;
	var len;

	for (i = 0; i < MaxIter; i++) {
		tmpTheta = theta;
		len = theta.length;
		for (j = 0; j < len; j++) {
			tmpTheta[j] = theta[j] + alpha * derivativeOfCLL(theta, observationSequence, labelingSequence, j);
		}
		theta = tmpTheta;
		// compute all theta
		jThetaHistory.push(computeCLL(initialTheta));
	}
};

// # Inference

// 1. generate matrix for every word

// 2. Matrix multiply

function predictCRF (labelingSequence, observationSequence, theta) {

};

/**
 * Compute conditional log likelihood
 * @return {number} the value of log likelihood.
 */
function computeCLL (theta, observations, labelingSequence) {
	// gi(yi−1, yi) = 􏰂j wj fj (yi−1, yi, x, i)

};

function derivativeOfCll (theta, observationSequence, labelingSequence, j) {
	var scoreThroughFeatureJ = computeF(observationSequence, labelingSequence, j);
	var expectScoreJ = computeExpectScoreJ(theta, observationSequence);
	return scoreThroughFeatureJ - expectScoreJ;
};

function computeExpectScoreJ (theta, observationSequence) {
	var zValue = computeZValue(theta, observationSequence);
	var allYPrimeValue = computeAllYPrime(theta, observationSequence);
	return allYPrimeValue / zValue;
};

function computeAllYPrime (theta, observationSequence) {
	var matrixArray = computeEverywordMatrix(theta, observationSequence);
	var len = matrixArray.length;
	for (var i = 0; i < len; i++) {
		matrixArray[i] = matrixArray[i].add(computeFeature)
	}
};

function computeZValue (theta, observationSequence) {
	if (!Array.isArray(observationSequence)) {
		console.log('observation sequence is not an Array.');
		return null;
	}
	var matrixArray = computeEverywordMatrix(theta, observationSequence);
	var zValue = multiplyAllMatrix(matrixArray);
	return zValue;
};

function computeEverywordMatrix (theta, observationSequence) {
	var len = observationSequence.length;
	var matrixArray = [];
	for (var i = 0; i < len; i++) {
		matrixArray.push(computeMatrix(theta, observationSequence, currentIndex));
	}
	return matrixArray;
};

function multiplyAllMatrix (matrixArray) {
	var result = matrixArray[0];
	var len = matrixArray.length;
	for (var i = 1; i < len; i++) {
		result = result.x(matrixArray[i]);
		if (!result) {
			console.log('error when multiply all matrixs');
			return null;	
		}
	}
	return result;
};

function computeMatrix (theta, observationSequence, currentIndex) {
	var i;
	var j;
	var matrix = [];

	for (i = 0; i < LABELING_LENGTH; i++) {
		matrix[i] = [];
	}

	// TODO: compute START and STOP vector

	for (i = 0; i < LABELING_LENGTH; i++) {
		for (j = 0; j < LABELING_LENGTH; j++) {
			matrix[i].push(goThroughFeatures(theta, i, j, observationSequence, currentIndex));
		}
	}

	matrix = $M(matrix);
	return matrix;
};

function computeF (observationSequence, labelingSequence, j) {
	var len = observationSequence.length;
	var score = 0;
	for (var i = 0; i < len; i++) {
		score += computeFeature(labelingSequence[i-1], labelingSequence[i], observationSequence, i, j);		
	}
	return score;
};

/**
 * compute jth feature.
 * @param {number} previous label 
 * @param {number} current label 
 * @param {Array} observationSequence
 * @param {number} current position index
 * @param {number} j jth of feature function set
 */
function computeFeature (prevLabel, currLabel, observationSequence, i, j) {
	// TODO feature functions call
	return featureFunctions[j].call(prevLabel, currLabel, observationSequence, i);
};

/**
 * check all features
 * 
 * @return {double} the score of current charactor
 */
function goThroughFeatures (theta, prevLabel, currLabel, observationSequence, currentIndex) {

};

function generateFeatureFunctions () {
	// this implementation will be done by Nathan.
};

/**
 * 
 * @return {boolean} match this feature or not.
 */
// function featureFunction (previousLabeling, currentLabeling, x, currentIndex) {

// };

function loadModel () {
	console.log('loading model');
};

