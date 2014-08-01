var Readable = require('stream').Readable
var inherits = require('util').inherits

module.exports = Bopper

function Bopper(audioContext){
  if (!(this instanceof Bopper)){
    return new Bopper(audioContext)
  }

  Readable.call(this, { objectMode: true })

  this.context = audioContext
  var processor = this._processor = audioContext.createScriptProcessor(512, 1, 1)
  this._processor.onaudioprocess = onAudioProcess.bind(this)

  var tempo = 120
  var cycleLength = (1 / audioContext.sampleRate) * this._processor.bufferSize

  this._state = {
    lastTime: 0,
    lastPosition: 0,
    playing: false,
    bpm: tempo,
    beatDuration: 60 / tempo,
    increment: (tempo / 60) * cycleLength,
    cycleLength: cycleLength
  }

  processor.connect(audioContext.destination)
}

inherits(Bopper, Readable)

var proto = Bopper.prototype

proto._read = function(){
  this._state.waiting = true
}

proto.start = function(){
  this._state.playing = true
}

proto.stop = function(){
  this._state.playing = false
}

proto.setTempo = function(tempo){
  var bps = tempo/60
  var state = this._state
  state.beatDuration = 60/tempo
  state.increment = bps * state.cycleLength
  state.bpm = tempo
  this.emit('tempo', state.bpm)
}

proto.getTempo = function(){
  return this._state.bpm
}

proto.isPlaying = function(){
  return this._state.playing
}

proto.setPosition = function(position){
  this._state.lastPosition = parseFloat(position) - this._state.increment
}

proto.setSpeed = function(multiplier){
  var state = this._state

  multiplier = parseFloat(multiplier) || 0

  var tempo = bpm * multiplier
  var bps = tempo/60

  state.beatDuration = 60/tempo
  state.increment = bps * cycleLength
}


proto.getPositionAt = function(time){
  var state = this._state
  return state.lastPosition - ((state.lastTime - time) * state.increment) - (state.increment*4)
}

proto.getTimeAt = function(position){
  var state = this._state
  var positionOffset = this.getCurrentPosition() - position
  return this.context.currentTime - (positionOffset * state.beatDuration)
}

proto.getCurrentPosition = function(){
  return this.getPositionAt(this.context.currentTime)
}

proto._schedule = function(time, from, to){
  var state = this._state
  if (state.waiting){
    this.push({
      from: from,
      to: to,
      time: time,
      duration: (to - from) * state.beatDuration,
      beatDuration: state.beatDuration
    })
  }
}

function onAudioProcess(e){
  var state = this._state
  var toTime = this.context.currentTime

  if (state.playing){
    var duration = toTime - state.lastTime
    var length = duration / state.beatDuration
    var position = state.lastPosition + length
    this._schedule(state.lastTime + (state.cycleLength*4), state.lastPosition, position)
    state.lastPosition = position
  }

  state.lastTime = toTime
}