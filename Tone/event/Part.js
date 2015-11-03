define(["Tone/core/Tone", "Tone/event/Event", "Tone/core/Type", "Tone/core/Transport"], function (Tone) {

	"use strict";
	
	/**
	 *  @class Tone.Part is a collection Tone.Events which can be
	 *         started/stoped and looped as a single unit.
	 *
	 *  @extends {Tone.Event}
	 *  @param {Function} callback The callback to invoke on each event
	 *  @param {Array} events the array of events to invoke
	 *  @example
	 * var part = new Tone.Part(function(time, note){
	 * 	synth.triggerAttackRelease(note, "8n", time);
	 * }, [[0, "C2"], ["0:2", "C3"], ["0:3:2", "G2"]]).start();
	 *  @example
	 * //use JSON as long as the object has a "time" attribute
	 * var part = new Tone.Part(function(time, value){
	 * 	synth.triggerAttackRelease(value.note, "8n", time, value.velocity);
	 * }, [{"time" : 0, "note" : "C3", "velocity": 0.9}, 
	 * 	   {"time" : "0:2", "note" : "C4", "velocity": 0.5}
	 * ]).start();
	 */
	Tone.Part = function(){

		var options = this.optionsObject(arguments, ["callback", "events"], Tone.Part.defaults);

		/**
		 *  If the part is looping or not
		 *  @type  {Boolean|Positive}
		 *  @private
		 */
		this._loop = options.loop;

		/**
		 *  When the note is scheduled to start.
		 *  @type  {Ticks}
		 *  @private
		 */
		this._loopStart = this.toTicks(options.loopStart);

		/**
		 *  When the note is scheduled to start.
		 *  @type  {Ticks}
		 *  @private
		 */
		this._loopEnd = this.toTicks(options.loopEnd);

		/**
		 *  The playback rate of the part
		 *  @type  {Positive}
		 *  @private
		 */
		this._playbackRate = options.playbackRate;

		/**
		 *  private holder of probability value
		 *  @type {NormalRange}
		 *  @private
		 */
		this._probability = options.probability;

		/**
		 *  the amount of variation from the
		 *  given time. 
		 *  @type {Boolean|Time}
		 *  @private
		 */
		this._humanize = options.humanize;

		/**
		 *  The start offset
		 *  @type {Ticks}
		 *  @private
		 */
		this._startOffset = 0;

		/**
		 *  Keeps track of the current state
		 *  @type {Tone.TimelineState}
		 *  @private
		 */
		this._state = new Tone.TimelineState(Tone.State.Stopped);

		/**
		 *  An array of Objects. Each one
		 *  contains a note object and the relative
		 *  start time of the note.
		 *  @type  {Array}
		 *  @private
		 */
		this._events = [];

		/**
		 *  The callback to invoke on every note
		 *  @type {Function}
		 */
		this.callback = options.callback;

		/**
		 * 	If the part invokes the callback
		 *  @type {Boolean}
		 */
		this.mute = options.mute;

		//add the events
		var events = this.defaultArg(options.events, []);
		if (!this.isUndef(options.events)){
			for (var i = 0; i < events.length; i++){
				if (Array.isArray(events[i])){
					this.add(events[i][0], events[i][1]);
				} else {
					this.add(events[i]);
				}
			}
		}
	};

	Tone.extend(Tone.Part, Tone.Event);

	/**
	 *  The default values
	 *  @type  {Object}
	 *  @const
	 */
	Tone.Part.defaults = {
		"callback" : Tone.noOp,
		"loop" : false,
		"loopEnd" : "1m",
		"loopStart" : 0,
		"playbackRate" : 1,
		"probability" : 1,
		"humanize" : false,
		"mute" : false,
	};

	/**
	 *  Start the part at the given time. Optionally
	 *  set an offset time.
	 *  @param  {Time}  time    When to start the part.
	 *  @param  {Time=}  offset  The offset from the start of the part
	 *                           to begin playing at.
	 *  @return  {Tone.Part}  this
	 */
	Tone.Part.prototype.start = function(time, offset){
		var ticks = this.toTicks(time);
		if (this._state.getStateAtTime(ticks) !== Tone.State.Started){
			offset = this.defaultArg(offset, 0);
			offset = this.toTicks(offset);
			this._state.addEvent({
				"state" : Tone.State.Started, 
				"time" : ticks, 
				"offset" : offset
			});
			this._forEach(function(event){
				this._startNote(event, ticks, offset);
			});
		}
		return this;
	};

	/**
	 *  Start the event in the given event at the correct time given
	 *  the ticks and offset and looping.
	 *  @param  {Tone.Event}  event 
	 *  @param  {Ticks}  ticks
	 *  @param  {Ticks}  offset
	 *  @private
	 */
	Tone.Part.prototype._startNote = function(event, ticks, offset){
		var startTick = ticks + offset;
		if (this._loop){
			var eventStartOffset = event.startOffset - this.startOffset;
			if (eventStartOffset >= this._loopStart && eventStartOffset < this._loopEnd){
				// startTick -= this._loopStart;
				event.start(startTick + "i", this.startOffset + "i");
			}
		} else {
			event.start(startTick + "i");
		}
	};

	/**
	 *  The start from the scheduled start time
	 *  @type {Ticks}
	 *  @memberOf Tone.Part#
	 *  @name startOffset
	 *  @private
	 */
	Object.defineProperty(Tone.Part.prototype, "startOffset", {
		get : function(){
			return this._startOffset;
		},
		set : function(offset){
			this._startOffset = offset;
			this._forEach(function(event){
				event.startOffset += offset;
			});
		}
	});

	/**
	 *  Stop the part at the given time.
	 *  @param  {Time}  time  When to stop the part.
	 *  @return  {Tone.Part}  this
	 */
	Tone.Part.prototype.stop = function(time){
		var ticks = this.toTicks(time);
		if (this._state.getStateAtTime(ticks) === Tone.State.Started){
			this._state.setStateAtTime(Tone.State.Stopped, ticks);
			this._forEach(function(event){
				event.stop(time);
			});
		}
		return this;
	};

	/**
	 *  Get/Set an Event's value at the given time. 
	 *  If a value is passed in and no event exists at
	 *  the given time, one will be created with that value. 
	 *  If two events are at the same time, the first one will
	 *  be returned.
	 *  @param {Time} time the time of the event to get or set
	 *  @param {*=} value If a value is passed in, the value of the
	 *                    event at the given time will be set to it.
	 *  @return {Tone.Event} the event at the time
	 */
	Tone.Part.prototype.at = function(time, value){
		time = this.toTicks(time);
		var tickTime = this.ticksToSeconds(1);
		for (var i = 0; i < this._events.length; i++){
			var event = this._events[i];
			if (Math.abs(time - event.startOffset) < tickTime){
				if (!this.isUndef(value)){
					event.value = value;
				}
				return event;
			}
		}
		//if there was no event at that time, create one
		if (!this.isUndef(value)){
			this.add(time + "i", value);
			//return the new event
			return this._events[this._events.length - 1];
		} else {
			return null;
		}
	};

	/**
	 *  Add a note or part to the part. 
	 *  @param {Time} time The time the note should start.
	 *                            If an object is passed in, it should
	 *                            have a 'time' attribute and the rest
	 *                            of the object will be used as the 'value'.
	 *  @param  {Tone.Event|*}  value 
	 *  @returns {Tone.Part} this
	 *  @example
	 * part.add("1m", "C#+11");
	 */
	Tone.Part.prototype.add = function(time, value){
		//extract the parameters
		if (this.isObject(time) && time.hasOwnProperty("time")){
			value = time;
			time = value.time;
			delete value.time;
		} 
		time = this.toTicks(time);
		var event;
		if (value instanceof Tone.Event){
			event = value;
			event.callback = this._tick.bind(this);
		} else {
			event = new Tone.Event({
				"callback" : this._tick.bind(this), 
				"value" : value,
			});
		}
		//the start offset
		event.startOffset = time;
		
		//initialize the values
		event.set({
			"loopEnd" : (this._loopEnd - this._loopStart) + "i",
			"loop" : this.loop,
			"humanize" : this.humanize,
			"playbackRate" : this.playbackRate,
			"probability" : this.probability
		});

		this._events.push(event);

		//start the note if it should be played right now
		this._restartEvent(event);
		return this;
	};

	/**
	 *  Restart the given event
	 *  @param  {Tone.Event}  event 
	 *  @private
	 */
	Tone.Part.prototype._restartEvent = function(event){
		var stateEvent = this._state.getEvent(this.now());
		if (stateEvent && stateEvent.state === Tone.State.Started){
			this._startNote(event, stateEvent.time, stateEvent.offset);
		}	
	};

	/**
	 *  Remove a note from the part. 
	 */
	Tone.Part.prototype.remove = function(time, value){
		//extract the parameters
		if (this.isObject(time) && time.hasOwnProperty("time")){
			value = time;
			time = value.time;
		} 
		time = this.toTicks(time);
		this._forEach(function(event, index){
			if (event.startOffset === time){
				if (this.isUndef(value) || (!this.isUndef(value) && event.value === value)){
					this._events.splice(index, 1);
					event.dispose();
				}
			}
		});
		return this;
	};

	/**
	 *  Remove all of the notes from the group. 
	 *  @return  {Tone.Part}  this
	 */
	Tone.Part.prototype.removeAll = function(){
		this._forEach(function(event){
			event.dispose();
		});
		this._events = [];
		return this;
	};

	/**
	 *  Cancel scheduled state change events: i.e. "start" and "stop".
	 *  @param {Time} after The time after which to cancel the scheduled events.
	 *  @return  {Tone.Part}  this
	 */
	Tone.Part.prototype.cancel = function(after){
		this._forEach(function(event){
			event.cancel(after);
		});
		this._state.cancel(after);
		return this;
	};

	/**
	 *  Iterate over all of the notes
	 *  @param {Function} callback
	 *  @private
	 */
	Tone.Part.prototype._forEach = function(callback){
		for (var i = this._events.length - 1; i >= 0; i--){
			callback.call(this, this._events[i], i);
		}
		return this;
	};

	/**
	 *  Set the attribute of all of the events
	 *  @param  {String}  attr  the attribute to set
	 *  @param  {*}  value      The value to set it to
	 *  @private
	 */
	Tone.Part.prototype._setAll = function(attr, value){
		this._forEach(function(event){
			event[attr] = value;
		});
	};

	/**
	 *  Internal tick method
	 *  @param  {Number}  time  The time of the event in seconds
	 *  @private
	 */
	Tone.Part.prototype._tick = function(time, value){
		if (!this.mute && this._state.getStateAtTime(Tone.Transport.ticks) === Tone.State.Started){
			this.callback(time, value);
		}
	};

	/**
	 *  Determine if the event should be currently looping
	 *  given the loop boundries of this Part.
	 *  @param  {Tone.Event}  event  The event to test
	 *  @private
	 */
	Tone.Part.prototype._testLoopBoundries = function(event){
		var eventStartOffset = event.startOffset - this.startOffset;
		if (eventStartOffset < this._loopStart || eventStartOffset >= this._loopEnd){
			event.cancel();
		} else {
			//reschedule it if it's stopped
			if (event.state === Tone.State.Stopped){
				this._restartEvent(event);
			}
		}
	};

	/**
	 *  The probability of the notes being triggered.
	 *  @memberOf Tone.Part#
	 *  @type {NormalRange}
	 *  @name probability
	 */
	Object.defineProperty(Tone.Part.prototype, "probability", {
		get : function(){
			return this._probability;
		},
		set : function(prob){
			this._probability = prob;
			this._setAll("probability", prob);
		}
	});

	/**
	 *  Random variation +/-0.01s to the scheduled time. 
	 *  Or give it a time value which it will randomize by.
	 *  @type {Boolean|Time}
	 *  @memberOf Tone.Part#
	 *  @name humanize
	 */
	Object.defineProperty(Tone.Part.prototype, "humanize", {
		get : function(){
			return this._humanize;
		},
		set : function(variation){
			this._humanize = variation;
			this._setAll("humanize", variation);
		}
	});

	/**
	 *  If the part should loop or not
	 *  between Tone.Part.loopStart and 
	 *  Tone.Part.loopEnd. An integer
	 *  value corresponds to the number of
	 *  loops the Part does after it starts.
	 *  @memberOf Tone.Part#
	 *  @type {Boolean|Positive}
	 *  @name loop
	 */
	Object.defineProperty(Tone.Part.prototype, "loop", {
		get : function(){
			return this._loop;
		},
		set : function(loop){
			this._loop = loop;
			this._forEach(function(event){
				event._loopStart = 0;
				event._loopEnd = (this._loopEnd - this._loopStart);
				event.loop = loop;
				this._testLoopBoundries(event);
			});
		}
	});

	/**
	 *  The loopEnd point determines when it will 
	 *  loop if Tone.Part.loop is true.
	 *  @memberOf Tone.Part#
	 *  @type {Boolean|Positive}
	 *  @name loopEnd
	 */
	Object.defineProperty(Tone.Part.prototype, "loopEnd", {
		get : function(){
			return this.toNotation(this._loopEnd + "i");
		},
		set : function(loopEnd){
			this._loopEnd = this.toTicks(loopEnd);
			if (this._loop){
				this._forEach(function(event){
					event.loopEnd = (this._loopEnd - this._loopStart) + "i";
					this._testLoopBoundries(event);
				});
			}
		}
	});

	/**
	 *  The loopStart point determines when it will 
	 *  loop if Tone.Part.loop is true.
	 *  @memberOf Tone.Part#
	 *  @type {Boolean|Positive}
	 *  @name loopStart
	 */
	Object.defineProperty(Tone.Part.prototype, "loopStart", {
		get : function(){
			return this.toNotation(this._loopStart + "i");
		},
		set : function(loopStart){
			this._loopStart = this.toTicks(loopStart);
			if (this._loop){
				this._forEach(function(event){
					event.loopEnd = (this._loopEnd - this._loopStart) + "i";
					this._testLoopBoundries(event);
				});
			}
		}
	});

	/**
	 * 	The playback rate of the part
	 *  @memberOf Tone.Part#
	 *  @type {Positive}
	 *  @name playbackRate
	 */
	Object.defineProperty(Tone.Part.prototype, "playbackRate", {
		get : function(){
			return this._playbackRate;
		},
		set : function(rate){
			this._playbackRate = rate;
			this._setAll("playbackRate", rate);
		}
	});

	/**
	 * 	The number of scheduled notes in the part. 
	 *  @memberOf Tone.Part#
	 *  @type {Positive}
	 *  @name length
	 *  @readOnly
	 */
	Object.defineProperty(Tone.Part.prototype, "length", {
		get : function(){
			return this._events.length;
		}
	});

	/**
	 *  Clean up
	 *  @return  {Tone.Part}  this
	 */
	Tone.Part.prototype.dispose = function(){
		this.removeAll();
		this._state.dispose();
		this._state = null;
		this.callback = null;
		this._events = null;
		return this;
	};

	return Tone.Part;
});