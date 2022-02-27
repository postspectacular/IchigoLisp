var modules = [];
var last_output = '';
var memory = new WebAssembly.Memory({initial: 4});
var importObject = {
    js: {
        memory: memory,
        table : new WebAssembly.Table(
            {initial: 512, element: 'anyfunc'}),
    },
    console: {
        log: function(arg) {
            console.log(arg);
        },
        logstr: function(arg) {
            console.log(getString(arg));
        },
    },
    io: {
        outputString: function(arg) {
            last_output = getString(arg);
            postMessage(['wasm', 'print', last_output]);
        },
        loadWasm: function(pos, size) {
            var bytes = getBinary(pos, size);
            WebAssembly.instantiate(bytes, importObject)
                .then(obj => {
                    modules.push(obj);
                });
        }
    },
};

var input_address = 51200;
function storeString(str) {
    var i8 = new Uint8Array(memory.buffer);
    var str_array = new TextEncoder('utf8').encode(str);
    for (var i = 0; i < str_array.length; i++) {
        i8[input_address + i] = str_array[i];
    }
    i8[input_address + str_array.length] = 0;
}

function getString(address) {
    var i8 = new Uint8Array(memory.buffer);
    var start = address, end = address;
    while (i8[end] != 0) { end++; }
    var bytes = new Uint8Array(memory.buffer, start, end - start);
    return new TextDecoder('utf8').decode(bytes);
}
function getBinary(address, size) {
    var i8 = new Uint8Array(memory.buffer);
    return new Uint8Array(memory.buffer, address, size);
}

function Eval(str) {
    storeString(str);
    ichigo.instance.exports.readAndEval();
    return last_output;
}

function Evalquote(str) {
    storeString(str);
    ichigo.instance.exports.readAndEvalquote();
    return last_output;
}

WebAssembly.instantiateStreaming(fetch('ichigo.wasm'), importObject)
    .then(obj => {
        ichigo = obj;
        ichigo.instance.exports.init();
        postMessage(['ichigo', 'init']);
    });

onmessage = function(e) {
    if (e.data.length < 2) {
        console.log('ichigo received a wrong message');
        return 0;
    }
    var sender = e.data[0];
    var type = e.data[1];
    if (type == 'eval') {
        postMessage([sender, type, Eval(e.data[2])]);
    } else if (type == 'evalquote') {
        postMessage([sender, 'eval', Evalquote(e.data[2])]);
    } else if (type == 'debug_level') {
        var level = e.data[2];
        console.log('debug_level = ' + level);
        ichigo.instance.exports.setDebugLevel(level);
        postMessage([sender, type]);
    }
}
