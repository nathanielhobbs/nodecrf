"use strict";
var sylvester = require('sylvester');
var featureGenerator = require('./featureGenerator_distroOneIndexAtATime.js');
var fs = require('fs');
var Matrix = sylvester.Matrix;
var trainingFile = './tests/testTraining2.data'
var templateFile = './tests/testTemplate'

featureGenerator.generateFeatures(trainingFile, templateFile, function(err, features){
	if(err)
		throw err;

	else{
		
		fs.readFile(trainingFile, 'utf8', function(error, trainingData) {
			if(error){
				callback(error);
			}

			// from matrix of all samples (vertical) along with feature data for each word (horizontal)
			// create an array of samples where each sample just contains an array of text (no need for feature generator info)
			var corpusMatrix = trainingData.split('\n');
			var samples = [];
			var currentSample = [];
			for(var i = 0; i < corpusMatrix.length; i++){
				corpusMatrix[i] = corpusMatrix[i].split(/\s/);

				if(corpusMatrix[i][0] !== '')
					currentSample.push(corpusMatrix[i]);

				if(corpusMatrix[i][0] === '' || i === corpusMatrix.length-1){
					samples.push(currentSample);
					currentSample = [];
				}
			}

			// create vector (i.e. an array) for feature weights
			var featureWeights = [];
			for(var j in features){
				// only objects with numerical keys are features
				if(j.match(/\d+/)){
					featureWeights[j] = 1;  //  TODO: this place-holder value should change
				}
			}

			var currentSampleMatrix = samples[0];
			var labelList = featureGenerator.getLabels(currentSampleMatrix);
			var localFeatureMatrixArray = createWeightedLocalFeatureArray(featureWeights, features, labelList, currentSampleMatrix);
			console.log('Local Feature Matrix Array: ')
			console.log(localFeatureMatrixArray)	

			var forwardMatrix = createForwardMatrix(featureWeights, features, localFeatureMatrixArray, labelList, currentSampleMatrix);
			console.log('Forward Matrix: ')
			console.log(forwardMatrix)

			var backwardMatrix = createBackwardMatrix(featureWeights, features, localFeatureMatrixArray, labelList, currentSampleMatrix);
			console.log('Backward Matrix: ')
			console.log(backwardMatrix)		

			var Z = computeRegularizationFactor(backwardMatrix, labelList);
			console.log('Z = ' + Z)	

		});
	}
});

// will return an array of matrices
function createWeightedLocalFeatureArray (featureWeights, features, labelList, currentSampleMatrix) {
	var len = currentSampleMatrix.length;
	var localFeatureMatrixArray = [];
	for (var currentIndex = 0; currentIndex < len; currentIndex++) {
		localFeatureMatrixArray.push(createWeightedLocalFeatureMatrix(featureWeights, features, labelList, currentSampleMatrix, currentIndex));
	}
	return localFeatureMatrixArray;
};

// returns a matrix of weighted feature sums for all possible labelings
function createWeightedLocalFeatureMatrix (featureWeights, features, labelList, currentSampleMatrix, currentIndex) {
	var matrix = [];

	for(var i = 0; i < labelList.length; i++){
		matrix[i] = [];
	}

	for(var i = 0; i < labelList.length; i++){
		for(var j = 0; j < labelList.length; j++){
			matrix[i].push(computeWeightedFeatureSum(featureWeights, features, labelList[i], labelList[j], currentSampleMatrix, currentIndex));
		}
	}

	matrix = $M(matrix);
	return matrix;
};

function computeWeightedFeatureSum (featureWeights, features, previousLabel, currentLabel, currentSampleMatrix, currentIndex) {
	var weightedSum = 0;

	for(var i in features){
		// only objects with numerical keys are features
		if(i.match(/\d+/)){
			weightedSum += featureWeights[i] * features[i].indicatorFunction(previousLabel, currentLabel, currentSampleMatrix, currentIndex);
			// console.log('indicator function value: ' + features[i].indicatorFunction(previousLabel, currentLabel, currentSampleMatrix, currentIndex));
		}
	}

	return weightedSum;
};

function createForwardMatrix(featureWeights, features, localFeatureMatrixArray, labelList, currentSampleMatrix){
	var forwardMatrix = [];
	// handle the base case
	forwardMatrix[0] = [];
	for(var i = 0; i < labelList.length; i++){
		forwardMatrix[0].push(computeWeightedFeatureSum(featureWeights, features, 'start', labelList[i], currentSampleMatrix, 0))
	}

	for(var i = 1; i < currentSampleMatrix.length; i++){ 
		forwardMatrix[i] = [];
		for(var currentLabelIndex = 0; currentLabelIndex < labelList.length; currentLabelIndex++){
			var result = 0;
			// console.log('computing next forward element for index ' + i + ' and label ' + labelList[currentLabelIndex])
			forwardMatrix[i].push(computeForwardElement(forwardMatrix, localFeatureMatrixArray, labelList, currentLabelIndex, i, result))
		}
	}

	return forwardMatrix;
}

function computeForwardElement(forwardMatrix, localFeatureMatrixArray, labelList, currentLabelIndex, index, result){
	// console.log('index = ' + index)

	for(var previousLabelIndex = 0; previousLabelIndex < labelList.length; previousLabelIndex++){
		// console.log('computing next value')
		// console.log(localFeatureMatrixArray[index])
		//note: A.e(i,j) returns the element Aij of matrix A, that is the element in the ith row and jth column. Indexes begin at 1, in agreement with mathematical notation.
		var unnormalizedProbAtIndex = localFeatureMatrixArray[index].e(previousLabelIndex+1, currentLabelIndex+1);
		var previousForwardElement = forwardMatrix[index-1][previousLabelIndex];
		// console.log('alpha(i-1): ' + previousForwardElement + ' unnormProbOfCurrIndex: ' + unnormalizedProbAtIndex)
		result += previousForwardElement * unnormalizedProbAtIndex;
		// console.log('so far result is ' + result)
	}
	// console.log('returning result: ' + result)
	return result;
}

// backwards array: B(y,i) = sum_y' ( (B(y', i+1) * M_i+1(y,y') ) 
function createBackwardMatrix(featureWeights, features, localFeatureMatrixArray, labelList, currentSampleMatrix){
	var backwardMatrix = [];
	var sampleLength = currentSampleMatrix.length;

	// handle the base case
	backwardMatrix[sampleLength-1] = [];
	for(var i = 0; i < labelList.length; i++){
		backwardMatrix[sampleLength-1].push(1)
	}

	for(var i = sampleLength-2; i >=0; i--){ 
		backwardMatrix[i] = [];
		for(var currentLabelIndex = 0; currentLabelIndex < labelList.length; currentLabelIndex++){
			var result = 0;
			// console.log('computing next forward element for index ' + i + ' and label ' + labelList[currentLabelIndex])
			backwardMatrix[i].push(computeBackwardElement(backwardMatrix, localFeatureMatrixArray, labelList, currentLabelIndex, i, result))
		}
	}

	return backwardMatrix;
}

function computeBackwardElement(backwardMatrix, localFeatureMatrixArray, labelList, currentLabelIndex, index, result){
	// console.log('index = ' + index)

	for(var nextLabelIndex = 0; nextLabelIndex < labelList.length; nextLabelIndex++){
		// console.log('computing next value')
		// console.log(localFeatureMatrixArray[index])
		//note: A.e(i,j) returns the element Aij of matrix A, that is the element in the ith row and jth column. Indexes begin at 1, in agreement with mathematical notation.
		var unnormalizedProbAtIndex = localFeatureMatrixArray[index+1].e(currentLabelIndex+1, nextLabelIndex+1);
		var previousBackwardElement = backwardMatrix[index+1][nextLabelIndex];
		// console.log('beta(i+1): ' + previousBackwardElement + ' unnormProbOfCurrIndex: ' + unnormalizedProbAtIndex)
		result += previousBackwardElement * unnormalizedProbAtIndex;
		// console.log('so far result is ' + result)
	}
	// console.log('returning result: ' + result)
	return result;
}

// Z(x) = sum_y beta(y, 1) = sum_y ( alpha(y, observationLength) )
function computeRegularizationFactor(backwardMatrix, labelList){
	var sum = 0;
	for(var i = 0; i < labelList.length; i++){
		sum += backwardMatrix[0][i];
	}
	return sum;
}
