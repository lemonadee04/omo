/**
 * Inside this file you will use the classes and functions from rx.js
 * to add visuals to the svg element in index.html, animate them, and make them interactive.
 *
 * Study and complete the tasks in observable exercises first to get ideas.
 *
 * Course Notes showing Asteroids in FRP: https://tgdwyer.github.io/asteroids/
 *
 * You will be marked on your functional programming style
 * as well as the functionality that you implement.
 *
 * Document your code!
 */

import "./style.css";

import { fromEvent, interval, merge, Subscription, from, of, Observable, combineLatest } from "rxjs";
import { map, filter, scan, concatMap, delay, toArray, mergeMap } from "rxjs/operators";
import * as Tone from "tone";
import { SampleLibrary } from "./tonejs-instruments";

/** Constants */

const Viewport = {
    CANVAS_WIDTH: 200,
    CANVAS_HEIGHT: 400,
} as const;

const Constants = {
    TICK_RATE_MS: 500,
    SONG_NAME: "RockinRobin",
} as const;

const Note = {
    RADIUS: 0.07 * Viewport.CANVAS_WIDTH,
    TAIL_WIDTH: 10,
};

const
    svg = document.getElementById("svgCanvas");

const STROKE_LEN = 350;

/** User input */

type Key = "KeyH" | "KeyJ" | "KeyK" | "KeyL";

type Event = "keydown" | "keyup" | "keypress";

const key$ = fromEvent<KeyboardEvent>(document, "keydown"); 

const fromKey = (keyCode: Key) =>
    key$.pipe(filter(({ code }) => code === keyCode));

/** Determines the rate of time steps */
    const tick$ = interval(Constants.TICK_RATE_MS).pipe(map(elapsed => new Tick(elapsed)));;   
    
/** Utility functions */

type Note = {
    user_played: string;
    instrument_name: string;
    velocity: string;
    pitch: string;
    start: string;
    end: string;
};

// function parseCsv(csvContents: string): ReadonlyArray<MusicNote> {
//     return csvContents
//         .split('\n')
//         .slice(1)
//         .map((line, index) => {
//             const [user_played, instrument_name, velocity, pitch, start, end] = line.split(',');
//             const xPos = (Number(pitch) % 4 + 1) * 20; // Map pitch % 4 to x-axis positions (20%, 40%, 60%, 80%)
//             return {
//                 id: index + 1, 
//                 viewType: 'note',
//                 user_played: user_played,
//                 instrument_name,
//                 velocity: velocity,
//                 pitch: pitch,
//                 start: start,
//                 end: end,
//                 pos: new Vec(xPos, 0), // Initial position at the top of the screen
//                 color: pitchToColor(pitch)
//             };
//         });
// }


/**
 * A simple immutable vector class
 */
class Vec {
    constructor(public readonly x: number = 0, public readonly y: number = 0) { }
    add = (b: Vec) => new Vec(this.x + b.x, this.y + b.y)

    static Zero = new Vec();
}

/**
 * Actions modify state
 */
interface Action {
    apply(s: State): State;
  }

/** State processing */

type State = Readonly<{
    gameEnd: boolean,
    notes: ReadonlyArray<MusicNote>,
    readonly time: number,
    readonly score: number,
    objCount: number,
    exit: ReadonlyArray<MusicNote>,
}>;

// const createNote = (id: number) => (note: Note) : MusicNote => ({
//     id: id,
//     viewType: 'note',
//     ...note,
//     pos: new Vec((Number(note.pitch)%4+1) * 20, 0),
//     color: pitchToColor(note.pitch),
// })

function pitchToColor(pitch: string): string{
    switch (Number(pitch)%4) {
        case 0: return 'url(#greenGradient)';
        case 1: return 'url(#redGradient)';
        case 2: return 'url(#blueGradient)';
        default: return 'url(#yellowGradient)';
    }
}

type MusicNote = {
    id: number;
    viewType: string;
    user_played: string;
    instrument_name: string;
    velocity: string;
    pitch: string;
    start: string;
    end: string;
    pos: Vec;
    color: string;
};


/**
 * Updates the state by proceeding with one time step.
 *
 * @param s Current state
 * @returns Updated state
 */
const tick = (s: State) => s;

const
    /**
     * Composable not: invert boolean result of given function
     * @param f a function returning boolean
     * @param x the value that will be tested with f
     */
    not = <T>(f: (x: T) => boolean) => (x: T) => !f(x),
    /**
     * is e an element of a using the eq function to test equality?
     * @param eq equality test function for two Ts
     * @param a an array that will be searched
     * @param e an element to search a for
     */
    elem =
        <T>(eq: (_: T) => (_: T) => boolean) =>
            (a: ReadonlyArray<T>) =>
                (e: T) => a.findIndex(eq(e)) >= 0,
    /**
     * set a number of attributes on an Element at once
     * @param e the Element
     * @param o a property bag
     */
    attr = (e: Element, o: { [p: string]: unknown }) => { for (const k in o) e.setAttribute(k, String(o[k])) }
/**
 * Type guard for use in filters
 * @param input something that might be null or undefined
 */
function isNotNullOrUndefined<T extends object>(input: null | undefined | T): input is T {
    return input != null;
}


class Tick implements Action {
    constructor(public readonly elapsed: number) { }
    /** 
     * interval tick: bodies move, collisions happen, bullets expire
     * @param s old State
     * @returns new State
     */
    
    apply(s: State): State {
        const
            expired = (n: MusicNote) => Number(n.pos.y) > STROKE_LEN,
            expiredNotes: MusicNote[] = s.notes.filter(expired),
            activeNotes = s.notes.filter(not(expired));
    
        // Return the updated state with the array of processed notes
        return {
            ...s,
            notes: activeNotes.map(Tick.moveNote(this.elapsed)),  // Keep the array of observable notes
            exit: expiredNotes  ,
            time: this.elapsed
        };
    }
    

    /** 
     * all tick-based physical movement comes through this function
     * @param o a Body to move
     * @returns the moved Body
     */
    static moveNote = (elapsed: number) => (note: MusicNote): MusicNote => ({
        ...note,
        pos: note.pos.add(new Vec(0, STROKE_LEN/(Number(note.end) - elapsed)))
    })
}

function createNote(note: MusicNote): SVGElement | null {
    // console.log("note:", note)
    if (svg){
        const circle = createSvgElement(svg.namespaceURI, "circle", {
            r: `${Note.RADIUS}`,
            cx: `${(Number(note.pitch)%4+1)*20}%`,
            cy: "0",
            style: `fill: ${pitchToColor(String(note.pitch))}`,
            class: "shadow",
        });
        svg.appendChild(circle);
        return circle;
    } else{
        return null
    }
}

/** Rendering (side effects) */

/**
 * Displays a SVG element on the canvas. Brings to foreground.
 * @param elem SVG element to display
 */
const show = (elem: SVGGraphicsElement) => {
    elem.setAttribute("visibility", "visible");
    elem.parentNode!.appendChild(elem);
};

/**
 * Hides a SVG element on the canvas.
 * @param elem SVG element to hide
 */
const hide = (elem: SVGGraphicsElement) =>
    elem.setAttribute("visibility", "hidden");

/**
 * Creates an SVG element with the given properties.
 *
 * See https://developer.mozilla.org/en-US/docs/Web/SVG/Element for valid
 * element names and properties.
 *
 * @param namespace Namespace of the SVG element
 * @param name SVGElement name
 * @param props Properties to set on the SVG element
 * @returns SVG element
 */
const createSvgElement = (
    namespace: string | null,
    name: string,
    props: Record<string, string> = {},
) => {
    const elem = document.createElementNS(namespace, name) as SVGElement;
    Object.entries(props).forEach(([k, v]) => elem.setAttribute(k, v));
    return elem;
};

/**
 * Update the SVG game view.  
 * 
 * @param onFinish a callback function to be applied when the game ends.  For example, to clean up subscriptions.
 * @param s the current game model State
 * @returns void
 */


    /**
     * state transducer
     * @param s input State
     * @param action type of action to apply to the State
     * @returns a new State 
     */
    const reduceState = (s: State, action: Action) => action.apply(s);

/**
 * This is the function called on page load. Your main game loop
 * should be called here.
 */
export function main(
    csvContents: string,
    samples: { [key: string]: Tone.Sampler },
) {
    // Canvas elements
    const svg = document.querySelector("#svgCanvas") as SVGGraphicsElement &
        HTMLElement;
    const preview = document.querySelector(
        "#svgPreview",
    ) as SVGGraphicsElement & HTMLElement;
    const gameover = document.querySelector("#gameOver") as SVGGraphicsElement &
        HTMLElement;
    const container = document.querySelector("#main") as HTMLElement;

    svg.setAttribute("height", `${Viewport.CANVAS_HEIGHT}`);
    svg.setAttribute("width", `${Viewport.CANVAS_WIDTH}`);

    // Text fields
    const multiplier = document.querySelector("#multiplierText") as HTMLElement;
    const scoreText = document.querySelector("#scoreText") as HTMLElement;
    const highScoreText = document.querySelector(
        "#highScoreText",
    ) as HTMLElement;

    /** User input */

    const key$ = fromEvent<KeyboardEvent>(document, "keydown"); // keyup

    const fromKey = (keyCode: Key) =>
        key$.pipe(filter(({ code }) => code === keyCode));

    /** Determines the rate of time steps */
    // const tick$ = interval(Constants.TICK_RATE_MS).pipe(map(elapsed => new Tick(elapsed)));
    const tick$ = interval(Constants.TICK_RATE_MS).pipe(map(elapsed => {
        return new Tick(elapsed);
      }));

    // /**
    //  * Renders the current state to the canvas.
    //  *
    //  * In MVC terms, this updates the View using the Model.
    //  *
    //  * @param s Current state
    //  */
    function render(onFinish: () => void): (_:State)=>void {
        return function (s: State):void {
            const
                svg = document.getElementById("svgCanvas");
    
            // Exit early if the required elements are not found
            if (!svg) return;
    
            // document.getElementById can return null
            // so use optional chaining to safely access method on element
            const show = (id: number, condition: boolean) => ((e: HTMLElement | null) =>
                condition ? e?.classList.remove('hidden')
                    : e?.classList.add('hidden'))(document.getElementById(String(id)))
    
            
            // null checking above cannot apply in updateBodyView
            // typescript cannot narrow the type down outside the scope because
            // it can't guarantee that this function gets called synchronously
            const updateNoteView = (rootSVG: HTMLElement) => (note: MusicNote) => {
                function createNoteView() {
                    const v = document.createElementNS(rootSVG.namespaceURI, "circle");
                    attr(v, { cx: `${(Number(note.pitch) % 4 + 1) * 20 }%`, cy: 0, color: pitchToColor(note.pitch) });
                    v.classList.add(note.viewType);
                    rootSVG.appendChild(v);
                    return v;
                }
                const v = document.getElementById(String(note.id)) || createNoteView();
                attr(v, { cx: note.pos.x, cy: note.pos.y });
            };
    
            s.notes.forEach(updateNoteView(svg));

            s.exit.map(o => document.getElementById(String(o.id)))
            .filter(isNotNullOrUndefined)
            .forEach(v => {
                try {
                    svg.removeChild(v)
                } catch (e) {
                    // rarely it can happen that a bullet can be in exit
                    // for both expiring and colliding in the same tick,
                    // which will cause this exception
                    console.log("Already removed: " + v.id)
                }
            })
            
            // score.innerHTML = String(s.score);
            // if (s.gameOver) {
            //     const v = document.createElementNS(svg.namespaceURI, "text");
            //     attr(v, { x: Constants.CanvasSize / 6, y: Constants.CanvasSize / 2, class: "gameover" });
            //     v.textContent = "Game Over";
            //     svg.appendChild(v);
            //     onFinish();
            // }
        }
    }

    const process = (text: string): Array<Observable<MusicNote>> => {
        const lines = text.split("\n").slice(1); // Split CSV lines, ignore header row
      
        // Return an array of observables
        return lines.map((line, index) => {
          const [user_played, instrument_name, velocity, pitch, start, end] = line.split(",");
          
          // Map each line into a MusicNote object
          const note: MusicNote = {
            id: index + 1,
            viewType: 'note',
            user_played: user_played,
            instrument_name,
            velocity: velocity,
            pitch: pitch,
            start: start, // Keep start as a string
            end: String(Number(end) * 1000), // Convert end to milliseconds (number)
            pos: new Vec((Number(pitch) % 4 + 1) * 20, 0), // Initial position at the top of the screen
            color: pitchToColor(pitch),
          };
      
          // Create an observable that emits the note with a delay based on its "end" time
          return of(note).pipe(
            delay(Number(note.end)) // Delay the emission of the note based on its end time
          );
        });
      }
    
    const notes$ = process(csvContents); // Array of observables for each note

    // Merge the array of observables into one stream
    const mergedNotes$ = merge(...notes$);
    
    // Subscribe to the merged stream and create each note
    mergedNotes$.subscribe(createNote);

    const initialState: State = {
        gameEnd: false,
        notes: notes$,
        time: 0,
        score: 0,
        objCount: 0,
        exit: [],
    } as const;

    console.log("notes", notes$);

    const source$: Observable<State> = tick$.pipe(scan(reduceState, initialState));

    source$.subscribe(s => {
        // console.log("State updated:", s);
        render(() => subscription.unsubscribe())(s);
    });
    
    const subscription: Subscription = source$.subscribe(render(() => subscription.unsubscribe()));

}

// The following simply runs your main function on window load.  Make sure to leave it in place.
// You should not need to change this, beware if you are.
if (typeof window !== "undefined") {
    // Load in the instruments and then start your game!
    const samples = SampleLibrary.load({
        instruments: [
            "bass-electric",
            "violin",
            "piano",
            "trumpet",
            "saxophone",
            "trombone",
            "flute",
        ], // SampleLibrary.list,
        baseUrl: "samples/",
    });

    const startGame = (contents: string) => {
        document.body.addEventListener(
            "mousedown",
            function () {
                main(contents, samples);
            },
            { once: true },
        );
    };

    const { protocol, hostname, port } = new URL(import.meta.url);
    const baseUrl = `${protocol}//${hostname}${port ? `:${port}` : ""}`;

    Tone.ToneAudioBuffer.loaded().then(() => {
        for (const instrument in samples) {
            samples[instrument].toDestination();
            samples[instrument].release = 0.5;
        }

        fetch(`${baseUrl}/assets/${Constants.SONG_NAME}.csv`)
            .then((response) => response.text())
            .then((text) => startGame(text))
            .catch((error) =>
                console.error("Error fetching the CSV file:", error),
            );
    });
}