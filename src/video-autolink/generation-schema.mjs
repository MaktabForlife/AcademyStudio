const string={type:'string'},integer={type:'integer'},nullableIndex={type:['integer','null']};
const object=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const list=items=>({type:'array',items});
export const generationSchema=object({
 summary:string,lessonReference:string,application:string,taskAssigned:{type:'boolean'},
 topics:list(object({time:string,title:string,sourceCueIndex:integer})),
 topicNotes:list(object({time:string,title:string,chapter:string,reflection:string,practice:string,sourceCueIndex:integer})),
 referenceCandidates:list(object({time:string,arabic:string,meaning:string,sourceCueIndex:nullableIndex,evidence:string})),
 quotationCandidates:list(object({time:string,text:string,speaker:string,sourceCueIndex:nullableIndex,evidence:string})),
 assignmentEvidence:list(object({sourceCueIndex:integer,evidence:string})),reviewNotes:list(string)
});
