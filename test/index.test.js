const assert = require("assert");
const fs = require("fs");

const YoutubeDlWrap = require("..");
const youtubeDlWrap = new YoutubeDlWrap();

describe('promise functions', function()
{
    describe('extractor list', function ()
    {
        it('should include youtube', async function()
        {
            let extractorList = await youtubeDlWrap.getExtractors();
            assert(Array.isArray(extractorList));
            assert(extractorList.includes("youtube"));
        });
    });   
    describe('extractor description list', function ()
    {
        it('should include YouTube.com channels', async function()
        {
            let extractorList = await youtubeDlWrap.getExtractorDescriptions();
            // console.log("extractorList", extractorList)
            // for(let a of extractorList)console.log(a);
            assert(Array.isArray(extractorList));
            assert(extractorList.includes("YouTube.com channels"));
        });
    });

    describe('help', function ()
    {
        it('should include explanation for version setting', async function()
        {
            let helpString = await youtubeDlWrap.getHelp();
            assert.equal(typeof helpString, "string");
            assert(helpString.includes("--version"));
        });
    });

    describe('user agent', function ()
    {
        it('should be a string with at least 10 characters', async function()
        {
            let userAgentString = await youtubeDlWrap.getUserAgent();
            assert.equal(typeof userAgentString, "string");
            assert(userAgentString.length >= 10);
        });
    });

    describe('version', function ()
    {
        it('should be a date', async function()
        {
            let versionString = await youtubeDlWrap.getVersion();
            assert(!isNaN( Date.parse( versionString.replace(/\./g, "-") ) ));
        });
    });

    describe('video Info', function ()
    {
        it('should have title Big Buck Bunny 60fps 4K - Official Blender Foundation Short Film', async function()
        {
            let videoInfo = await youtubeDlWrap.getVideoInfo("https://www.youtube.com/watch?v=aqz-KE-bpKQ");
            assert.equal(videoInfo.title, "Big Buck Bunny 60fps 4K - Official Blender Foundation Short Film");
        });
    });
});


describe('event emitter function', function()
{
    it('should download a video', async function()
    {
        let youtubeDlEventEmitter = await youtubeDlWrap.exec(["https://www.youtube.com/watch?v=C0DPdy98e4c", "-f", "worst", "-o", "test/testVideo.mp4"]);
        let progressDefined = true;
        youtubeDlEventEmitter.on("progress", (progressObject) => 
        {
            if(progressObject.percent == undefined      || progressObject.totalSize == undefined ||
               progressObject.currentSpeed == undefined || progressObject.eta == undefined )
               progressDefined = false;

        });
        youtubeDlEventEmitter.on("close", (code) => 
        {
            assert(fs.existsSync("test/testVideo.mp4"));
            fs.unlinkSync("test/testVideo.mp4");
            assert(progressDefined);
            assert.equal(code, 0);
        });
    });    
});
