"use strict";

var fs = require('fs');
var async = require('async');
var trainingFile, templateFile;
var templateArray = []; // will be defined in setTemplateArray
var featureCount = 0;

if(process.argv[1] === 'node' && process.argv.length !== 4){
	console.log("Invalid input.  Please specify a both a test file and template file name, e.g. node featureGenerator.js test.data template")
	throw error;
}

else if(process.argv.length === 4 && !process.argv[2].match(/\.data/)){
	console.log("Invalid input.  The test file should have a .data extension")
	throw error;
}

if(process.argv.length === 4){
	trainingFile = process.argv[2];
	templateFile = process.argv[3];

	createFeatures(trainingFile, templateFile, function(err, result){
		if (err) throw err;
	});
}

module.exports.generateFeatures = createFeatures;

function createFeatures (trainingFile, templateFile, callback) {
	verifyTrainingAndTemplate(trainingFile, templateFile);
	console.time('Generate Features')

	featureCount = 0;
	//open training file
	fs.readFile(trainingFile, {encoding: 'utf8'}, function(error, trainingData) {
		if(error){
			callback(error);
		}

		var dataMatrix = trainingData.split('\n');

		// get list of all labels that are in training data
		var labelList = getLabelList(dataMatrix);				

		// open template file
		fs.readFile(templateFile, 'utf8', function (error, templateData) {
			if(error) {
				callback(error);
			}

			// First look at template file to see which features we care about in the training file
			var templateDataArray = templateData.split('\n'); 
			buildTemplateArray(templateDataArray, function(error, result){
				if(error)
					callback(error)
				templateArray = result;
			});

			// Look at training file and generate expanded features according to template macros
			var expandedFeaturesObject = buildFeatures(templateArray, dataMatrix, labelList);

			var featureIndicatorFunctions = buildFeatureIndicatorFunctions(expandedFeaturesObject);
			
			printSummary()

			callback(null,featureIndicatorFunctions);
			// console.log(expandedFeaturesObject['38'][0]+":"+decodeMacroChain(expandedFeaturesObject['38'][0], dataMatrix, 4))

			// fs.writeFile('features.txt', JSON.stringify(expandedFeaturesObject), 'utf8', printSummary(callback))
		});
	});
}

function buildFeatureIndicatorFunctions(expandedFeaturesObject) {
	var featuresWithIndicatorFunction = {};

	featuresWithIndicatorFunction.decodeMacroChain = function (featureMacro, dataMatrix, index){
		var macroList = featureMacro.match(/%x\[[-]?\d+,\d+\]/g);
		var featurePrefix = featureMacro.substring(0,featureMacro.indexOf(':')+1);
		var decodedMacroSequence = '';

		for(var j=0; j<macroList.length;j++){
			var columnStartIndex = macroList[j].indexOf(',')+1;
			var columnEndIndex = macroList[j].indexOf(']');
			var rowStartIndex = macroList[j].indexOf('[')+1;
			var rowEndIndex = macroList[j].indexOf(',');
			var currentMacroColumn = parseInt(macroList[j].substring(columnStartIndex, columnEndIndex), 10);
			var currentMacroRow = parseInt(macroList[j].substring(rowStartIndex, rowEndIndex), 10);
			var decodedMacroValue = '';

			// check for boundry conditions for macro (i.e. for first word in training doc with template entry %x[-1,0])
			if(index + currentMacroRow < 0){
				decodedMacroValue = '_B'+(index + currentMacroRow); // will result in value of the form e.g. _B-1 (where _B-1 is the token before the start of a sample)
			}
			// check for boundry condition when currentMacroRow is looking past last word in document
			else if(index + currentMacroRow >= dataMatrix.length){
				decodedMacroValue = '_B+'+(index + currentMacroRow - dataMatrix.length + 1); // will result in value of the form e.g. _B+1 (where _B+1 is the token after the end of a sample)
			}
			//else the standard case
			else{ 
				var trainingEntryArray = dataMatrix[index+currentMacroRow].split(/\s/);
				decodedMacroValue = trainingEntryArray[currentMacroColumn];
			}

			if(j === 0){
				decodedMacroSequence = featurePrefix + decodedMacroValue;
			}
			else{
				decodedMacroSequence += '/' + decodedMacroValue;
			}
		}
		return decodedMacroSequence;
	}

	for(var featureNumber in expandedFeaturesObject){
		// expandecFeaturesObject[key] has format [unformmatedMacro, decodedMacro, previousLabel, currentLabel]
		var macro = expandedFeaturesObject[featureNumber][0];
		var featureDecodedMacro = expandedFeaturesObject[featureNumber][1];
		var featurePreviousLabel = expandedFeaturesObject[featureNumber][2];
		var featureCurrentLabel = expandedFeaturesObject[featureNumber][3];

		featuresWithIndicatorFunction[featureNumber] = function (previousLabel, currentLabel, dataMatrix, index){
			var decodedMacro = featuresWithIndicatorFunction.decodeMacroChain(macro, dataMatrix, index);
			if(featurePreviousLabel === "n/a"){
				if(currentLabel === featureCurrentLabel && decodedMacro === featureDecodedMacro)
					return 1;
			}
			else if(previousLabel === featurePreviousLabel && 
					currentLabel === featureCurrentLabel && 
					decodedMacro === featureDecodedMacro)
				return 1;
			else
				return 0;
		};
	}

	return featuresWithIndicatorFunction;

	// for(var feature in featuresWithIndicatorFunction){
	// 	console.log(featuresWithIndicatorFunction[feature].toString())
	// }

	
}

function buildFeatures(templateArray, dataMatrix, labelList){
	var expandedFeatures = {};
	var testFeatureFunc = {};
	for(var i=0; i<templateArray.length; i++){
		var unlabeledFeatures = [];
		var labeledMacroFeatures = [];
		var currentFeatureMacro = templateArray[i];

		var step = 0;

		if(templateArray[i] !== 'B')
			unlabeledFeatures = buildFeaturesFromMacros(currentFeatureMacro, dataMatrix);
		else
			unlabeledFeatures.push('B') // this is a special feature template that only features for y_i-1 and y_i label combinations, there is no macro

		// console.log("unlabeled Features:")
		// console.log(unlabeledFeatures)
		labeledMacroFeatures = labelFeatures(unlabeledFeatures, labelList);
		// console.log(labeledMacroFeatures)


		for (var feature in labeledMacroFeatures) { 
			var featurePreviousLabel = feature.substring(feature.lastIndexOf(':')+1, feature.lastIndexOf(',')).trim();
			var featureCurrentLabel = feature.substring(feature.lastIndexOf(',')+1, feature.length).trim();
			var currentMacro = templateArray[i];
			var decodedMacro = feature.substring(0, feature.lastIndexOf(':'));
			var featureInfo = [currentMacro, decodedMacro, featurePreviousLabel, featureCurrentLabel];

			expandedFeatures[featureCount] = featureInfo;
			featureCount++;
		}
	}
	return expandedFeatures;
}

function decodeMacroChain(featureMacro, dataMatrix, index){
	var macroList = featureMacro.match(/%x\[[-]?\d+,\d+\]/g);
	var featurePrefix = featureMacro.substring(0,featureMacro.indexOf(':')+1);
	var decodedMacroSequence = '';

	for(var j=0; j<macroList.length;j++){
		var columnStartIndex = macroList[j].indexOf(',')+1;
		var columnEndIndex = macroList[j].indexOf(']');
		var rowStartIndex = macroList[j].indexOf('[')+1;
		var rowEndIndex = macroList[j].indexOf(',');
		var currentMacroColumn = parseInt(macroList[j].substring(columnStartIndex, columnEndIndex), 10);
		var currentMacroRow = parseInt(macroList[j].substring(rowStartIndex, rowEndIndex), 10);
		var decodedMacroValue = '';

		// check for boundry conditions for macro (i.e. for first word in training doc with template entry %x[-1,0])
		if(index + currentMacroRow < 0){
			decodedMacroValue = '_B'+(index + currentMacroRow); // will result in value of the form e.g. _B-1 (where _B-1 is the token before the start of a sample)
		}
		// check for boundry condition when currentMacroRow is looking past last word in document
		else if(index + currentMacroRow >= dataMatrix.length){
			decodedMacroValue = '_B+'+(index + currentMacroRow - dataMatrix.length + 1); // will result in value of the form e.g. _B+1 (where _B+1 is the token after the end of a sample)
		}
		//else the standard case
		else{ 
			var trainingEntryArray = dataMatrix[index+currentMacroRow].split(/\s/);
			decodedMacroValue = trainingEntryArray[currentMacroColumn];
		}

		if(j === 0){
			decodedMacroSequence = featurePrefix + decodedMacroValue;
		}
		else{
			decodedMacroSequence += '/' + decodedMacroValue;
		}
	}
	return decodedMacroSequence;
}

function buildFeaturesFromMacros(featureMacro, dataMatrix){
	var unlabeledFeatures = [];
	var macroList = featureMacro.match(/%x\[[-]?\d+,\d+\]/g);
	var featurePrefix = featureMacro.substring(0,featureMacro.indexOf(':')+1);

	for(var j=0; j<macroList.length;j++){
		var columnStartIndex = macroList[j].indexOf(',')+1;
		var columnEndIndex = macroList[j].indexOf(']');
		var rowStartIndex = macroList[j].indexOf('[')+1;
		var rowEndIndex = macroList[j].indexOf(',');
		var currentMacroColumn = parseInt(macroList[j].substring(columnStartIndex, columnEndIndex), 10);
		var currentMacroRow = parseInt(macroList[j].substring(rowStartIndex, rowEndIndex), 10);
		var decodedMacroValue = '';
		var relativePositionInSample;
		var sampleNumber = 0;

		// iterate through each line of the dataMatrix (i.e. each entry in the training data set)
		// and create a unique feature for that entry based on the current macro
		for(var absolutePosition = 0; absolutePosition < dataMatrix.length; absolutePosition++){

			if(dataMatrix[absolutePosition-1] === '' || absolutePosition === 0)
				relativePositionInSample = 0;
			else
				relativePositionInSample++;

			// check for boundry conditions for macro (i.e. for first word in training doc with template entry %x[-1,0])
			if(currentMacroRow+relativePositionInSample < 0){
				decodedMacroValue = '_B'+(relativePositionInSample+currentMacroRow); // will result in value of the form e.g. _B-1 (where _B-1 is the token before the start of a sample)
			}
			// check for boundry condition when currentMacroRow is looking past last word in document
			else if(currentMacroRow+absolutePosition >= dataMatrix.length){
				decodedMacroValue = '_B+'+(currentMacroRow+absolutePosition-dataMatrix.length+1); // will result in value of the form e.g. _B+1 (where _B+1 is the token after the end of a sample)
			}
			// check for boundry condition when currentMacroRow is looking past last word in sample
			else if(macroOvershootOfSampleLength(dataMatrix, absolutePosition, currentMacroRow) > 0){
				var endOfSamplePosition = macroOvershootOfSampleLength(dataMatrix, absolutePosition, currentMacroRow);
				decodedMacroValue = '_B+'+(currentMacroRow+absolutePosition-endOfSamplePosition); // will result in value of the form e.g. _B+1 (where _B+1 is the token after the end of a sample)
			}
			// throw away conditions
			else if(dataMatrix[absolutePosition] === ''  	// an empty value shouldn't have any features
					|| dataMatrix[absolutePosition+currentMacroRow] === ''  	// features should not be created using the boundry spaces between samples
					|| (featurePrefix.match(/^B/) && currentMacroRow+relativePositionInSample < 0))  // bigram features shouldn't be created for words on the edge of the sample.
			{ 
				//keep track of sample number for labeling compound featueres
				if(dataMatrix[absolutePosition] === ''){
					sampleNumber++; 
				}
				continue;
			}
			//else the standard case
			else{ 
				var trainingEntryArray = dataMatrix[absolutePosition+currentMacroRow].split(/\s/);
				decodedMacroValue = trainingEntryArray[currentMacroColumn];
			}

			// keep track to a temperary expandedFeature until each of the macros have been iterated through
			if(j == 0){
				unlabeledFeatures.push(featurePrefix + decodedMacroValue);
			}
			else{
				// console.log('absolutePosition: ' + absolutePosition)
				// console.log('pushing ' + '/'+ decodedMacroValue + ' after ' + unlabeledFeatures[absolutePosition-sampleNumber])
				unlabeledFeatures[absolutePosition-sampleNumber] += '/' + decodedMacroValue;
			}

		}	
	}
	return unlabeledFeatures;
}

function labelFeatures(unlabeledFeatures, labelList){
	var expandedFeaturesObject = {};
	for(var j = 0; j< unlabeledFeatures.length; j++){
		var thisFeature = unlabeledFeatures[j];
		if(thisFeature.match(/^B/)){
			for(var k=0; k < labelList.length; k++){
				for(var l=0; l< labelList.length; l++){
					if (!expandedFeaturesObject.hasOwnProperty(thisFeature + ': ' +  labelList[l] + ', ' + labelList[k])) {
						expandedFeaturesObject[thisFeature + ': ' +  labelList[l] + ', ' + labelList[k]] = '';
					}
				}
			}
		}
		else if(thisFeature.match(/^U/)){
			// console.log(labelList)
			for(var k=0; k < labelList.length; k++){
				if (!expandedFeaturesObject.hasOwnProperty(thisFeature + ': n/a, ' + labelList[k])) {
					expandedFeaturesObject[thisFeature+ ': n/a, '  + labelList[k]] = '';
				}
			}
		}
	}
	return expandedFeaturesObject;
}

function buildTemplateArray(templateDataArray, callback){
	var templateArray = [];
	var foundFeature = false;
	for(var i = 0; i < templateDataArray.length; i++){
		if(templateDataArray[i].match(/^U/) || templateDataArray[i].match(/^B/)){
			foundFeature = true;
			if(!templateDataArray[i].match(/%x\[[-]?[0-9]+,[-]?[0-9]+\]$/) && templateDataArray[i] !== 'B'){
				callback(new Error('Error with ' + templateDataArray[i]+ '. Please make sure each macro is of the form  %x[row,col].'));
			}
			templateArray.push(templateDataArray[i]);
		}
	}
	if(!foundFeature)
		callback(new Error('No valid feature macros defined'));

	callback(null, templateArray);
}

function getLabelList(dataMatrix){
	var labelList = [];
	for(var j = 0; j < dataMatrix.length; j++){
		var trainingEntryArray = dataMatrix[j].split(/\s/);
		var currentLabel = trainingEntryArray[trainingEntryArray.length-1];

		if(labelList.indexOf(currentLabel) < 0 && currentLabel !== '')
			labelList.push(currentLabel);
	}
	return labelList;
}

function macroOvershootOfSampleLength(dataMatrix, absolutePosition, currentMacroRow){
	for(var i = absolutePosition; i <= absolutePosition+currentMacroRow; i++){
		if(dataMatrix[i] === ''){
			return i-absolutePosition; 
		}
	}
	return -1;
}

function verifyTrainingAndTemplate(trainingFile, templateFile){
	if( !trainingFile || !templateFile)
		throw new Error('Both a training file and a template file are required to be set before envoking the feature generator.');

	if(trainingFile === null || templateFile === null)
		throw new Error('Both training file and template file are required to be non-null');

	if(!trainingFile.match(/\.data/))
		throw new Error('Invalid input.  The test file should have a .data extension');
}

function printSummary(callback){
	console.log('Number of Features Generated: ' + featureCount);
	console.timeEnd('Generate Features');
}