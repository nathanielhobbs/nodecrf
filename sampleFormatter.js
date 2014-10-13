"use strict";

var fs = require('fs');
var async = require('async')
var sampleArray = []; //sampleArray should be of the form [{tag:[],word:[],entity:[]},...,{}]

if(process.argv.length<3){
	console.log("Invalid input.  Please specify a file name, e.g. node sampleFormatter corpus.txt (corpus.txt is a file where each line is a JSON object: {tag:[],word:[],idendity:[]}  )")
	return;
}

for(var i = 2; i < process.argv.length; i++){
	fs.readFile(process.argv[i], 'utf8', function(err, data){
		if(err) throw err;
	
		var sampleArray = data.split('\n'); //sampleArray should be of the form [{tag:[],word:[],entity:[]},...,{}]

		for (var i = 0; i < sampleArray.length; i++){
			var outputFileName = "samples/preannotated/sample_"+i+".json";

			var workingSample = tryParseJson(sampleArray[i])

			if(workingSample && workingSample !== "null"){				
				//Here we define the sample object that we will fill up and then write to a file
				var sample = {
					words:[], 
					tags:[], 
					namedEntities:[]
				};

				// console.log(workingSample)

				//assign the sample words and tags; entities need more processing and are assigned below
				sample.words = workingSample.word;
				sample.tags = workingSample.tag;
				var entities = workingSample.entity; //this will be in the form  [start_index, end_index, entity_label]

				//build entity name and save it to sample.namedEntitites
				for(var j=0; j<entities.length; j++){
					var entity = entities[j]; //entity has form [start_index, end_index, entity_label]
					var startIndex = entity[0];
					var endIndex = entity[1];
					var entityLabel = entity[2];

					// console.log("entity: " + entity)
					// console.log("startIndex:  " + startIndex);
					// console.log("endIndex: " + endIndex);
					// console.log("entityLabel: " + entityLabel);

					for(var index = startIndex; index<endIndex; index++){
						if(entityLabel === "product_name"){
							sample.namedEntities[index] = entityLabel;
							// console.log("Added entity label " + entityLabel + " at location " + index);
						}
					}	
				}

				for(var j = 0; j<sample.words.length; j++){
					if(!sample.namedEntities[j])
						sample.namedEntities[j] = "uncategorized";

					 // console.log(j + "\t" + sample.words[j] + "\t" + sample.tags[j] + "\t" + sample.namedEntities[j]);
				}

				fs.writeFile(outputFileName, JSON.stringify(sample, null, 4), function(err){
					if(err)
						console.log(err);
					else
						console.log("JSON saved to " + outputFileName);
				});
			}
				
		}
	});

}

function tryParseJson(str) {
    try {
        return JSON.parse(str);
    } catch (ex) {
        return null;
    }
}