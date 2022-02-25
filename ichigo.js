var last_output = '';
var memory = new WebAssembly.Memory({initial: 4});
var importObject = {
    js: {
        memory: memory,
        table : new WebAssembly.Table(
            {initial: 256, element: 'anyfunc'}),
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
        // TODO: remove this
        printlnString: function(arg) {
        },
        outputString: function(arg) {
            last_output = getString(arg);
            postMessage(['wasm', 'print', last_output]);
        },
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

function Eval(str) {
    storeString(str);
    ichigo.instance.exports.readAndEval();
    return last_output;
}

WebAssembly.instantiateStreaming(fetch('ichigo.wasm'), importObject)
    .then(obj => {
        ichigo = obj;
        ichigo.instance.exports.init();
    });

onmessage = function(e) {
    if (e.data.length < 2) {
        console.log('ichigo received a wrong message');
        return 0;
    }
    var sender = e.data[0];
    var type = e.data[1];
    if (type == 'eval') {
        var out = Eval(e.data[2]);
        postMessage([sender, type, out]);
    } else if (type == 'debug_level') {
        var level = e.data[2];
        console.log('debug_level = ' + level);
        ichigo.instance.exports.setDebugLevel(level);
        postMessage([sender, type]);
    }
}
