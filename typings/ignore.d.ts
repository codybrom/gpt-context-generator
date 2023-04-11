declare module 'ignore' {
    interface Ignore {
       add(pattern: string | ReadonlyArray<string>): this;
       ignores(pathname: string): boolean;
    }
 
    function createIgnore(): Ignore;
 
    export = createIgnore;
 }
 