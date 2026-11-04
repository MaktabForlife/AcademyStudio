import './preserve-local-files.mjs';
import {buildStudioPackage} from './build-studio-package.mjs';
const value=await buildStudioPackage({version:process.argv[2]});
console.log(JSON.stringify({...value,manifest:undefined,localFilesDeleted:0,previousPackageRequired:false}));
