

var GPU = function() {
    this.frequency = 4194304; // ~4.194 MHz
    this.cycle = 0;
    this.expectedCycle = 0;
    this.ly = 0x1;
    this.scx = 0x0;
    this.scy = 0x0;
    this.vram = [];
    this.log = false;
    for (var address = 0x8000; address < 0xA000; address++)
        this.vram[address] = 0x0;

    this.display = new Display(this);
};

GPU.prototype.tick = function(dt) {
    this.expectedCycle += this.frequency * dt;
    if (this.cycle > this.expectedCycle)
        return;
    if (++this.ly > 153) this.ly = 0;
};

GPU.prototype.read = function(address) {
    switch(address) {
        case 0xFF42: return this.scy; // Scroll Y.
        case 0xFF44: return this.ly;  // LCD Y Coordinate.
        default:
            throw 'Error: Invalid GPU read from 0x' + address.toString(16).toUpperCase();
    }
};

GPU.prototype.write = function(address, data) {
    if (address >= 0x8000 && address < 0xA000) {
        this.vram[address] = data;
        var tile = (address - 0x8000) / 16 | 0;
        var tileY = tile / 32 | 0;
        var tileX = tile % 32;
        this.display.updateTile(tileX, tileY);
        return;
    }

    switch(address) {
        case 0xFF40: // LCD Control.
            if (this.log) console.log('LCD Control: 0x' + data.toString(16).toUpperCase());
            break;
        case 0xFF41: if (this.log) console.log('LCD: Status'); break; // LCD status.
        case 0xFF42: this.scy = data; break; // Set ScrollY coordinate.
        case 0xFF43: this.scx = data; break; // Set ScrollX coordinate.
        case 0xFF47: break; // Background palette.
        default:
            throw 'Error: Invalid GPU write to 0x' + address.toString(16).toUpperCase();
    }
};

var Display = function(gpu) {
    this.gpu = gpu;
    this.vram = [];
    this.canvas = document.getElementsByTagName('canvas')[0];
    if (!this.canvas)
        throw 'Error: Missing canvas element.';
    this.context = this.canvas.getContext('2d');
    this.context.imageSmoothingEnabled = false;
    this.buffer = this.context.getImageData(0, 0, this.canvas.width, this.canvas.height);

    this.tiles = this.context.createImageData(512, 512);
    for (var i = 0; i < this.tiles.data.length; i+=4) {
        this.tiles.data[i] = 0x0;
        this.tiles.data[i+1] = 0x0;
        this.tiles.data[i+2] = 0x0;
        this.tiles.data[i+3] = 0xFF;
    }
};

Display.prototype.blit = function() {
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    for (var tileY = 0; tileY < 32; tileY++) {
        for (var tileX = 0; tileX < 32; tileX++) {
            var tile = this.gpu.vram[0x9800 + tileY * 32 + tileX];
            //if (tile === 0) continue; // For now, probably not true.
            var sx = (tile % 32) * 8;
            var sy = (tile / 32 | 0) * 8;
            this.context.putImageData(this.tiles,
                tileX * 8 - sx,
                tileY * 8 - sy - this.gpu.scy,
                sx, sy, 8, 8);
        }
    }
};

Display.prototype.updateTile = function(tileX, tileY) {
    var address = 0x8000 + tileY * 512 + tileX * 16;
    for (var line = 0; line < 8; line++) {
        var low = this.gpu.vram[address + line * 2];
        var hi = this.gpu.vram[address + line * 2 + 1];

        for (var bit = 0; bit < 8; bit++)
        {
            var px = tileX * 8 + bit;
            var py = tileY * 8 + line;
            var mask = 1 << (7 - bit);
            var index = (low & mask ? 1 : 0) + (hi & mask ? 2 : 0);
            var color = index ? 0 : 255;
            var offset = (px + py * 512) * 4;
            this.tiles.data[offset] = color;
            this.tiles.data[offset+1] = color;
            this.tiles.data[offset+2] = color;
        }
    }
}


