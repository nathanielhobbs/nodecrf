"use strict";
var sylvester = require('sylvester');
var featureGenerator = require('./featureGenerator_distroOneIndexAtATime.js');
var fs = require('fs');
var bigNum = require('big-number').n;
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

			var forwardVectorArray = createForwardVectorArray(featureWeights, features, localFeatureMatrixArray, labelList, currentSampleMatrix);
			console.log('Forward Matrix: ')
			console.log(forwardVectorArray)

			var backwardVectorArray = createBackwardVectorArray(featureWeights, features, localFeatureMatrixArray, labelList, currentSampleMatrix);
			console.log('Backward Matrix: ')
			console.log(backwardVectorArray)		

			var Z = computeRegularizationFactor(backwardVectorArray, labelList);
			console.log('Z = ' + Z)	
			console.log(computeUnigramMarginalProbability(forwardVectorArray, backwardVectorArray, Z, 0, 0))

			// var featureObject = features['3']; //choosing one w/o start/stop label for easier testing
			// var currentFeatureMatrixArray = computeKthFeatureMatrixArray(featureObject, localFeatureMatrixArray, labelList, currentSampleMatrix);
			// console.log('Feature Matrix Array for arbitrary feature:')
			// console.log(currentFeatureMatrixArray)			

			var gradientArray = [];
			for(var j in features){
				// only objects with numerical keys are features
				if(j.match(/\d+/)){
					var currentFeatureMatrixArray = computeKthFeatureMatrixArray(features[j], localFeatureMatrixArray, labelList, currentSampleMatrix);
					var empericalFeatureCount = computeEmpericalFeatureCount(features[j], currentSampleMatrix);
					var expectedFeatureCount = computeExpectedFeatureCount(forwardVectorArray, backwardVectorArray, currentFeatureMatrixArray, Z);
					console.log('Feature ' + j+ ': ' + JSON.stringify(features[j]))
					console.log('Expected count for feature ' + j+ ': ' + expectedFeatureCount)
					console.log('emprical count for feautre' + j + ': '+ empericalFeatureCount)
					gradientArray.push(empericalFeatureCount-expectedFeatureCount);
				}
			}
			console.log('Gradient Array:')
			console.log(gradientArray)

			// console.log(expectedFeatureCount(forwardVectorArray, backwardVectorArray, currentFeatureMatrixArray))
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

	return Math.exp(weightedSum);
};

function createForwardVectorArray(featureWeights, features, localFeatureMatrixArray, labelList, currentSampleMatrix){
	var forwardMatrix = [];
	// handle the base case
	forwardMatrix[0] = [];
	for(var i = 0; i < labelList.length; i++){
		forwardMatrix[0].push(computeWeightedFeatureSum(featureWeights, features, 'start', labelList[i], currentSampleMatrix, 0));
	}

	for(var i = 1; i < currentSampleMatrix.length; i++){ 
		forwardMatrix[i] = [];
		for(var currentLabelIndex = 0; currentLabelIndex < labelList.length; currentLabelIndex++){
			var result = 0;
			forwardMatrix[i].push(computeForwardElement(forwardMatrix, localFeatureMatrixArray, labelList, currentLabelIndex, i, result));
		}
	}

	for(var i = 0; i < forwardMatrix.length; i++){
		forwardMatrix[i] = $M(forwardMatrix[i]);
	}

	return forwardMatrix;
}

function computeForwardElement(forwardMatrix, localFeatureMatrixArray, labelList, currentLabelIndex, index, result){
	for(var previousLabelIndex = 0; previousLabelIndex < labelList.length; previousLabelIndex++){
		//note: A.e(i,j) returns the element Aij of matrix A, that is the element in the ith row and jth column. Indexes begin at 1, in agreement with mathematical notation.
		var unnormalizedProbAtIndex = localFeatureMatrixArray[index].e(previousLabelIndex+1, currentLabelIndex+1);
		var previousForwardElement = forwardMatrix[index-1][previousLabelIndex];

		result += previousForwardElement * unnormalizedProbAtIndex;
	}
	return result;
}

// backwards array: B(y,i) = sum_y' ( (B(y', i+1) * M_i+1(y,y') ) 
function createBackwardVectorArray(featureWeights, features, localFeatureMatrixArray, labelList, currentSampleMatrix){
	var backwardMatrix = [];
	var sampleLength = currentSampleMatrix.length;

	// handle the base case
	backwardMatrix[sampleLength-1] = [];
	for(var i = 0; i < labelList.length; i++){
		backwardMatrix[sampleLength-1].push(computeWeightedFeatureSum(featureWeights, features, labelList[i], 'stop', currentSampleMatrix, sampleLength-1));
	}

	for(var i = sampleLength-2; i >=0; i--){ 
		backwardMatrix[i] = [];
		for(var currentLabelIndex = 0; currentLabelIndex < labelList.length; currentLabelIndex++){
			var result = 0;
			backwardMatrix[i].push(computeBackwardElement(backwardMatrix, localFeatureMatrixArray, labelList, currentLabelIndex, i, result));
		}
	}

	for(var i = 0; i < backwardMatrix.length; i++){
		backwardMatrix[i] = $M(backwardMatrix[i]);
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
function computeRegularizationFactor(backwardVectorArray, labelList){
	var sum = 0;
	for(var i = 0; i < labelList.length; i++){
		// note: Vector/Matrix element indices begin at 1, not 0 like array indexes.
		sum += backwardVectorArray[0].e(i+1, 1);
	}
	return sum;
}

function computeUnigramMarginalProbability(forwardVectorArray, backwardVectorArray, Z, wordIndex, currentLabelIndex){
	// note: Vector element indexes begin at 1, not 0 like array indexes.
	return forwardVectorArray[currentLabelIndex].e(wordIndex+1) * backwardVectorArray[currentLabelIndex].e(wordIndex+1) / Z;
}

// for pos i: Pr(y',y | x) = alpha(y', i-1) * M_i(y',y) * beta(y, i+1)
function computeBigramMarginalProbability(forwardVectorArray, backwardVectorArray, Z, wordIndex, currentLabelIndex, previousLabelIndex, localFeatureMatrixArray){
	// note: Vector element indexes begin at 1, not 0 like array indexes.
	var result = forwardVectorArray[previousLabelIndex].e(wordIndex) * localFeatureMatrixArray[wordIndex+1].e(previousLabelIndex+1, currentLabelIndex+1);
	result = result * backwardVectorArray[currentLabelIndex].e(wordIndex+2) / Z;
	return result;
}

// this matrix array will be used when computing the expectation of a feature
// matrix Q(y,y') = f_k(y',y,x,i) * M_i(y',y)
function computeKthFeatureMatrixArray(featureObject, localFeatureMatrixArray, labelList, currentSampleMatrix){
	var matrixArray = [];

	// each word in the sample will have a corresponding matrix
	for(var index = 0; index < localFeatureMatrixArray.length; index++){
		var featureMatrix = [];
		// create a square matrix indexed by labels
		for(var i = 0; i < labelList.length; i++){
			featureMatrix[i] = [];
			for(var j = 0; j < labelList.length; j++){
				var previousLabel = labelList[i];
				var currentLabel = labelList[j];
				var indicatorFuncResult = featureObject.indicatorFunction(previousLabel, currentLabel, currentSampleMatrix, index);
				var weightedFeatureSum = localFeatureMatrixArray[i].e(i + 1, j + 1);

				featureMatrix[i].push(indicatorFuncResult * weightedFeatureSum)
			}
		}

		matrixArray.push(featureMatrix);
	}

	for(var i = 0; i < matrixArray.length; i++){
		matrixArray[i] = $M(matrixArray[i])
	}

	return matrixArray;
}

// sum_i (alpha_i-1 * Q_i * beta(i))
// alpha, beta are forward/backward vectores at position i, indexed by labels
// Q_i is a matrix st
function computeExpectedFeatureCount(forwardVectorArray, backwardVectorArray, kthFeatureArray, Z){
	var expectedValue = 0;
	for(var i = 0; i < forwardVectorArray.length-1; i++){
		var alphaTranspose = forwardVectorArray[i].transpose();
		
		expectedValue += alphaTranspose.x(kthFeatureArray[i+1]).x(backwardVectorArray[i+1]).e(1,1);
		// console.log('expectedValue so far is ' + expectedValue)
	}
	return expectedValue/Z;
}

function computeEmpericalFeatureCount(featureObject, currentSampleMatrix){
	var previousLabel, currentLabel;
	var labelIndex = currentSampleMatrix[0].length-1;
	var count = 0;

	for(var i = 0; i < currentSampleMatrix.length; i++){
		if(i === 0)
			previousLabel = 'start';
		else
			previousLabel = currentSampleMatrix[i-1][labelIndex];

		if(i === currentSampleMatrix.length)
			currentLabel = 'stop'
		else 
			currentLabel = currentSampleMatrix[i][labelIndex];

		if(featureObject.indicatorFunction(previousLabel, currentLabel, currentSampleMatrix, i)){
			count++;
		}
	}

	return count;
}