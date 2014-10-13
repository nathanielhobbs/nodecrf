 "use strict";

var fs = require('fs');
var mongo = require('mongoskin');
var db = mongo.db('mongodb://localhost:27017/testDB'); //connect to domainInfo db by default
var chineseProductsDb = db.collection('chineseProducts');
var async = require('async')

var sampleSize = 1;

var samples = [];

if(process.argv.length<3){
	console.log("Invalid input.  Please specify a file name, e.g. node sampleToAnnotatedSample sampleFile.json")
	return;
}

for(var i = 2; i < process.argv.length; i++){
	try {
		var sampleJSON = require(process.argv[i]);
	}catch(err){
		try {
			sampleJSON = require('./' + process.argv[i]);
		}catch(err){
			console.log("ERROR opening the file: "+ err);
			return;
		}
	}

	generateFeatures(sampleJSON)
}

function generateFeatures(sampleJSON){
	var ObservationEntry = {
		word:"",
		partOfSpeech: "",
		wordLength: 0,
		isAlphaNum: null,
		isNumber: null,
		isAscii: null,
		isCamleCase: null,
		beginsWithCapitalLetter: null,
		isPunctuationMark:null,
		isExactMatchInProductDb: null,
		isPartialMatchInProductDb: null,
		numberOfPartialMatchesInProductDb: 0,
		previousWord: "",
		previousTwoWords: "",
		previousThreeWords:"",
		nextWord: "",
		nextTwoWords:"",
		nextThreeWords:"",
		namedEntitylabel:""
	};
	var observationList = [];
	var observationLength = sampleJSON.words.length;

	// evaluate features that can be assigned values via synchronous processses
	// ----------------------------------------------------------------------------
	for (var i=0; i<observationLength; i++){
		var currentWord = sampleJSON.words[i];
		var currentObservation = Object.create(ObservationEntry);

		currentObservation.word = currentWord;
		currentObservation.partOfSpeech = sampleJSON.tags[i];
		currentObservation.namedEntitylabel = sampleJSON.namedEntities[i];
		currentObservation.wordLength = currentWord.length;	
		if(isAlphaNum(currentWord))
			currentObservation.isAlphaNum = 1;
		else
			currentObservation.isAlphaNum = 0;
		if(isNumber(currentWord))
			currentObservation.isNumber = 1;
		else
			currentObservation.isNumber = 0;
		if(isPunctuation(currentWord))
			currentObservation.isPunctuationMark = 1;
		else
			currentObservation.isPunctuationMark = 0;
		if(isAscii(currentWord))
			currentObservation.isAscii = 1;
		else
			currentObservation.isAscii = 0;
		if(isCamelCase(currentWord))
			currentObservation.isCamelCase = 1;
		else
			currentObservation.isCamelCase = 0;
		if(beginsWithCapitalLetter(currentWord))
			currentObservation.beginsWithCapitalLetter = 1;
		else
			currentObservation.beginsWithCapitalLetter = 0;

		observationList.push(currentObservation);	
	}

	// console.log(observationList.length)

	// evalute features that can only be assigned values via asynchronous processes
	// ------------------------------------------------------------------------------

	//for each item in observationList, check if it is an exact match in the DB
	async.each(observationList, checkObservationElementForExactMatchInDb, function(err){
		if(err)	throw err;

		// console.log("Done checking for exact db matches")

	});

	//for each item in observationList, check if it is a partial match in the DB
	async.each(observationList, checkObservationElementForPartialMatchInDb, function(err){
		if(err)	throw err;

		// console.log("Done checking for partial db matches")

		// console.log("word   POS  isAlphaNum   isNumber  isPunctuation  isAscii   isCamelCase    beginsWith[A-Z]   wordLength   exactMatchInProdDB    partialMatchInProdDB    #ofPartialMatchesInProdDB   entityLabel") //x-1    x-2,1   x-3,2,1  x+1  x+1,2  x+1,2,3
		// console.log("============================================================================")

		// Upon successful traversal of the entire list, print the results
		for (var i=0; i<observationLength; i++){
			if(observationList[i].isExactMatchInProductDb === true)
				observationList[i].isExactMatchInProductDb = 1;
			else
				observationList[i].isExactMatchInProductDb = 0;

			if(observationList[i].isPartialMatchInProductDb === true)
				observationList[i].isPartialMatchInProductDb = 1;
			else
				observationList[i].isPartialMatchInProductDb = 0;

			console.log(observationList[i].word 
						+ "\t\t" + observationList[i].partOfSpeech
						+ "\t\t" + observationList[i].isAlphaNum 
						+ "\t\t" + observationList[i].isNumber 
						+ "\t\t" + observationList[i].isPunctuationMark
						+ "\t\t" + observationList[i].isAscii
						+ "\t\t" + observationList[i].isCamelCase
						+ "\t\t" + observationList[i].beginsWithCapitalLetter 
						+ "\t\t" + observationList[i].wordLength 
						+ "\t\t" + observationList[i].isExactMatchInProductDb
						+ "\t\t" + observationList[i].isPartialMatchInProductDb
						+ "\t\t" + observationList[i].numberOfPartialMatchesInProductDb
						+ "\t\t" + observationList[i].namedEntitylabel)
		}
		console.log("\n")

		process.exit();

	});

}

function isAlphaNum(word){
	var alphaRegExp = /[a-zA-Z]+/;
	var numRegExp = /[0-9]+/;

	if(word.match(alphaRegExp) && word.match(numRegExp))
		return true;
	else 
		return false;

}

function isNumber(word){
	var numRegExp = /^[-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?$/;

	if(word.match(numRegExp))
		return true;
	else 
		return false;

}

function isAscii(word){
	var asciiRegularExpression = /^[\x00-\x7F]+$/

	if(word.match(asciiRegularExpression))
		return true;
	else 
		return false;
}

function isPunctuation(word){
	var chinesePuncRegExp = /[\,\.\s\(\)\[\]\|，。？！┊【】、；：“”‘’（）「」]/;
	// var englishPuncRegExp = 
	// 						var -._~:/?#@!$&\'*+;=
	// 						\'"\.,\[\]\{\}\(\)\!#\^&\*\:;\|\\

	if(word.match(chinesePuncRegExp))
		return true;
	else
		return false;
}

function isCamelCase(word){
	var camelRegExp = /([A-Z0-9]*[a-z][a-z0-9]*[A-Z]|[a-z0-9]*[A-Z][A-Z0-9]*[a-z])[A-Za-z0-9]*/;

	if(word.match(camelRegExp))
		return true;
	else 
		return false;

}

function beginsWithCapitalLetter(word){
	var capitalRegExp = /(^[A-Z]{1})/
	// var exactlyOneCapital = /(^[A-Z]{1})([a-z0-9]+)/

	if(word.match(capitalRegExp))
		return true;
	else 
		return false;
}

function exactMatchInProductDB(word, matchFound){
	chineseProductsDb.findOne({_id: word}, function (error, result) {
		if(error)
			throw error;
		if(result){
			// console.log(word + " found in db")
			return true;
		}
		else{
			//console.log(word + " not found in db")
			return false;
		}
	});
}

function partialMatchInProductDB(word){

}

function checkObservationElementForExactMatchInDb(observationElement, callback){
	chineseProductsDb.findOne({_id: observationElement.word}, function (error, result) {
		if(error)
			throw error;
		if(result){
			// console.log( observationElement.word+ " found in db")
			observationElement.isExactMatchInProductDb = true;
		}
		else{
			// console.log( observationElement.word + " not found in db")
			observationElement.isExactMatchInProductDb = false;
		}
		callback();
	});
}

function checkObservationElementForPartialMatchInDb(observationElement, callback){
	var word = observationElement.word;

	// console.log(word)

	//assign the word to a regular expression (prepend by '\' if need be)
	try{
		var testRegExp = new RegExp(word,"i");
	} catch(err) {
		
		try{
			word = '\\' + word;
			testRegExp = new RegExp(word,"i");
		}catch(err){
			throw err;
		}
	}

	//use the regular expression of the word to check for partial matches in the db
	chineseProductsDb.find({_id: testRegExp}, function (error, result) {
		if(error)	throw error;
		
		//console.log(result)
		if(result){
			result.count(function(error, count){
				if(error)	throw error;

				if(count === 0){
					// console.log("no results found for " + wordsArray[i])
					observationElement.isPartialMatchInProductDb = false;
					observationElement.numberOfPartialMatchesInProductDb = 0;
					// console.log("done with " + wordsArray[i])
					
					callback();	
				}
				else{
					result.each(function (error, product) {
						if(error){
							throw error;
						}
						if(product){
							observationElement.isPartialMatchInProductDb = true;
							observationElement.numberOfPartialMatchesInProductDb++;
						}	
						if(!product){
							 // console.log("done with " + observationElement.word)
							callback();	
						}		
					});		
				}
			});

		}
		else{
			console.log("should not be here")
		}
	});

			
}

// console.log(beginsWithCapitalLetter("Hello"))
// console.log(beginsWithCapitalLetter("Hel123412lo"))
// console.log(beginsWithCapitalLetter("hello"))
// console.log(beginsWithCapitalLetter("hEllo"))
// console.log(beginsWithCapitalLetter("9ello"))

// console.log(isNumber("123421"))
// console.log(isNumber("12.3421"))
// console.log(isNumber("-123421"))
// console.log(isNumber("-1234.21"))
// console.log(isNumber("asdfsad1234a21"))
// console.log(isNumber("1234a21"))
// console.log(isNumber("asdfsadf"))

// for (var i=0; i<sampleSize; i++){
// 	var fileJSON = require('./sample_'+i+'.json');
// 	console.log(JSON.parse(fileJSON));
// }

// var word = "去"
// chineseProductsDb.findOne({_id: word}, function (error, result) {
// 	if(error)
// 		throw error;
// 	if(result){
// 		console.log(word + " found in db")
// 	}
// 	else{
// 		console.log(word + " not found in db")
// 	}
// });


//var jsonObj = JSON.parse(fileJSON);
//