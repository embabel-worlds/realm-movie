"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MovieReview = exports.MovieWatchlistEntry = exports.MovieRating = exports.MovieTasteSummary = exports.MovieStreamingPreferences = exports.UserStreamingSubscription = exports.StreamingService = exports.Movie = void 0;
const runtime_types_1 = require("@embabel/runtime-types");
// Schema metadata is read off the AST by `embabel-build-manifest`. The local implementations
// are intentional no-ops when the compiled realm module is loaded.
const schema_decorators_1 = require("./schema-decorators");
// ─── The node types ─────────────────────────────────────────────────────────
// Schema and behaviour together, in one language, checked by one compiler. Previously the
// schema half lived in `types/movies.yml` and nothing verified that a producer, an anchor
// or a target type actually existed until the world loaded and warned.
/**
 * A film, keyed by IMDb id. The canonical metadata record the assistant references when
 * discussing a movie; created on first OMDb lookup and re-used for every subsequent rating,
 * recommendation, or recall.
 *
 * No stored `imdbUrl`: OMDb doesn't return one, but it is derivable from the id in a query —
 * `'https://www.imdb.com/title/' + m.imdbId + '/' AS imdbUrl`.
 */
let Movie = class Movie extends runtime_types_1.Entity {
    /** The injected gateway, typed to the ops this realm uses. */
    get api() {
        return this.gateway;
    }
    /**
     * Where this movie is streaming in a country (ISO-3166 alpha-2, lowercase — e.g. 'us', 'au').
     */
    async streaming(args) {
        return this.api.streamingAvailability.getShow({ id: this.imdbId, country: args.country });
    }
    /**
     * Fresh OMDb metadata (full plot, ratings, runtime) for this movie.
     */
    async details() {
        return this.api.omdb.getMovie({ i: this.imdbId, plot: "full" });
    }
    /**
     * Record the CURRENT USER's rating of this movie (1–10). Recording IS making the link:
     * createEntry against MovieRating auto-emits (me)-[:RATED]->(MovieRating) — and `me` is
     * also a Person, so it reads uniformly with other people's ratings. Identity is
     * `<myId>::<imdbId>`, so a re-rate updates in place. The same gateway op the card's star
     * widget calls. (Attributing a rating to ANOTHER person is a separate flow that resolves
     * that person and links their node.)
     */
    async rate(args) {
        const me = await this.currentUser();
        const raterId = me.id || "";
        const data = {
            ratingKey: `${raterId}::${this.imdbId}`,
            raterId,
            raterName: me.name,
            imdbId: this.imdbId,
            title: this.title,
            rating: args.rating,
            notes: args.notes,
            watchedOn: args.watchedOn,
        };
        return this.api.repository.createEntry({ type: "MovieRating", data });
    }
    /**
     * Put this film on the CURRENT USER's persistent "Want to See" list. Identity is
     * `<myId>::<imdbId>`, so saving it again refreshes the same node rather than duplicating it.
     */
    async saveForLater() {
        const me = await this.currentUser();
        const userId = me.id || "";
        if (!userId)
            throw new Error("The current user could not be resolved.");
        const data = {
            watchlistKey: `${userId}::${this.imdbId}`,
            userId,
            imdbId: this.imdbId,
            title: this.title,
            year: this.year,
            director: this.director,
            genre: this.genre,
            poster: this.poster,
            plot: this.plot,
            addedOn: new Date().toISOString(),
        };
        return this.api.repository.createEntry({ type: "MovieWatchlistEntry", data });
    }
    /** The current user's own Person id + name, read from the scoped graph. */
    async currentUser() {
        const res = await this.api.kg.query({
            cypher: "MATCH (me:AssistantUser) RETURN me.id AS id, me.name AS name LIMIT 1",
            params: JSON.stringify({}),
        });
        const rows = Array.isArray(res) ? res : res.rows || [];
        return rows[0] || {};
    }
};
exports.Movie = Movie;
__decorate([
    (0, schema_decorators_1.Id)()
], Movie.prototype, "imdbId", void 0);
__decorate([
    (0, schema_decorators_1.Property)({ type: "int" })
], Movie.prototype, "year", void 0);
__decorate([
    (0, schema_decorators_1.Property)({ type: "int" })
], Movie.prototype, "runtimeMinutes", void 0);
__decorate([
    (0, schema_decorators_1.Property)({ type: "number" })
], Movie.prototype, "imdbRating", void 0);
__decorate([
    (0, schema_decorators_1.Property)({ type: "int" })
], Movie.prototype, "imdbVotes", void 0);
__decorate([
    (0, schema_decorators_1.Relationship)({
        type: "AVAILABLE_ON", producer: "streamingByImdb",
        keyField: "imdbId", recordKeyField: "imdbId",
        description: "Streaming services where this Movie can be watched in the user's country. Only films with at " +
            "least one option appear, so a plain MATCH filters recommendations to what the user can stream. " +
            "The EDGE carries the per-film option details (producer edgeProject): `watchLink` (deep link to " +
            "THIS film on the service) and `offerType` (subscription / free / rent / buy) — read them off " +
            "the relationship: MATCH (m)-[ao:AVAILABLE_ON]->(s) RETURN ao.watchLink, ao.offerType.",
    })
], Movie.prototype, "availableOn", void 0);
__decorate([
    (0, schema_decorators_1.Relationship)({
        type: "HAS_REVIEW", producer: "movieReviews",
        keyField: "title", recordKeyField: "movieTitle",
        description: "Individual web-found reviews of the film (one node per review — url, headline, outlet, critic, " +
            "excerpt, score), gathered by an LLM with web search and cached. Many per film; ORDER BY " +
            "r.score DESC for the best. Reach it from a recommendation: (m:Movie)-[:HAS_REVIEW]->(r:MovieReview).",
    })
], Movie.prototype, "reviews", void 0);
exports.Movie = Movie = __decorate([
    (0, schema_decorators_1.Node)({
        // Shared reference metadata, NOT user-owned. A film isn't "owned" by a user — the user's
        // relationship to it is the rating. Without this, `Movie` falls to the framework default
        // (`OWNED_BY` from-entry) and every film wrongly gets `(Movie)-[:OWNED_BY]->(User)`,
        // double-anchoring it alongside the rating. `false` makes `MovieRating` the SOLE bridge:
        //   (User)-[:RATED]->(MovieRating)-[:OF]->(Movie)
        userAnchor: false,
    })
    // When the LLM looks a film up via OMDb, auto-bind the result as a Movie in working state
    // (named after a slug of the title, e.g. 'jade') so it's in scope for follow-ups — no
    // explicit save needed. fieldMap maps the OMDb response (Title/imdbID-cased) onto the
    // Movie's own field names.
    ,
    (0, schema_decorators_1.Retrieval)({
        operation: "omdb.getMovie",
        nameFrom: "title",
        fieldMap: {
            imdbId: "imdbID",
            title: "Title",
            year: "Year",
            genre: "Genre",
            country: "Country",
            director: "Director",
            runtimeMinutes: "Runtime",
            plot: "Plot",
            imdbRating: "imdbRating",
            imdbVotes: "imdbVotes",
            poster: "Poster",
        },
    })
], Movie);
/**
 * A streaming service (Netflix, Stan, …) a Movie can be watched on in the user's country.
 *
 * VIRTUAL — fetched on demand from the Streaming Availability API when a query traverses
 * AVAILABLE_ON; never stored. ONE node per service (identity `serviceId`), shared by every
 * film — the per-film facts (the deep link, how it's offered) live on each film's own
 * AVAILABLE_ON edge. Use it to filter recommendations to films the user can actually
 * stream, and to tell them WHERE:
 *
 * ```cypher
 * MATCH (m:Movie)-[ao:AVAILABLE_ON]->(s:StreamingService)
 * RETURN m.title, s.serviceName, ao.offerType, ao.watchLink
 * ```
 */
let StreamingService = class StreamingService extends runtime_types_1.Entity {
};
exports.StreamingService = StreamingService;
__decorate([
    (0, schema_decorators_1.Id)()
], StreamingService.prototype, "serviceId", void 0);
exports.StreamingService = StreamingService = __decorate([
    (0, schema_decorators_1.Node)({ userAnchor: false })
], StreamingService);
/**
 * A streaming service the CURRENT USER subscribes to — the per-user half of the streaming
 * catalog. Created and deleted through the app's country-specific checklist. The user anchor
 * gives `(:AssistantUser)-[:SUBSCRIBES_TO]->(:UserStreamingSubscription)`; filter recommendations
 * to what the user can actually watch by intersecting a Movie's AVAILABLE_ON services on
 * `serviceId`:
 *
 * ```cypher
 * MATCH (m:Movie)-[:AVAILABLE_ON]->(s:StreamingService)
 * WHERE EXISTS { (:AssistantUser)-[:SUBSCRIBES_TO]->(:UserStreamingSubscription {serviceId: s.serviceId}) }
 * ```
 */
let UserStreamingSubscription = class UserStreamingSubscription extends runtime_types_1.Entity {
};
exports.UserStreamingSubscription = UserStreamingSubscription;
__decorate([
    (0, schema_decorators_1.Id)()
], UserStreamingSubscription.prototype, "serviceId", void 0);
exports.UserStreamingSubscription = UserStreamingSubscription = __decorate([
    (0, schema_decorators_1.Node)({ userAnchor: { predicate: "SUBSCRIBES_TO", direction: "from-user" } })
], UserStreamingSubscription);
/**
 * The CURRENT USER's streaming market. Streaming catalogues and licences vary by
 * country, so this is persisted explicitly rather than guessed from locale or a
 * deployment default.
 */
let MovieStreamingPreferences = class MovieStreamingPreferences extends runtime_types_1.Entity {
};
exports.MovieStreamingPreferences = MovieStreamingPreferences;
__decorate([
    (0, schema_decorators_1.Id)()
], MovieStreamingPreferences.prototype, "userId", void 0);
exports.MovieStreamingPreferences = MovieStreamingPreferences = __decorate([
    (0, schema_decorators_1.Node)({ userAnchor: { predicate: "HAS_MOVIE_STREAMING_PREFERENCES", direction: "from-user" } })
], MovieStreamingPreferences);
/**
 * A one-per-user synthesis of the user's film taste, distilled from their MovieRatings.
 *
 * VIRTUAL — there is no stored MovieTasteSummary; it is materialized on demand by
 * aggregating (fan-IN) the user's ratings into ~100 words (producer `movieTasteSummary`,
 * cached weekly). Reach it from the user and read `ts.summary`:
 *
 * ```cypher
 * MATCH (me:AssistantUser)-[:HAS_MOVIE_TASTE_SUMMARY]->(ts:MovieTasteSummary) RETURN ts.summary
 * ```
 */
let MovieTasteSummary = class MovieTasteSummary extends runtime_types_1.Entity {
};
exports.MovieTasteSummary = MovieTasteSummary;
__decorate([
    (0, schema_decorators_1.Id)()
], MovieTasteSummary.prototype, "userId", void 0);
__decorate([
    (0, schema_decorators_1.Property)({ type: "int" })
], MovieTasteSummary.prototype, "count", void 0);
__decorate([
    (0, schema_decorators_1.Relationship)({
        type: "SUGGESTS", producer: "tasteBasedPicks",
        keyField: "summary", recordKeyField: "fromTaste",
        description: "Films that match your OVERALL taste, generated from your taste summary rather than from any one " +
            "rating. A good \"surprise me based on everything I like\" list; exclude films you've already rated.",
    })
], MovieTasteSummary.prototype, "suggestions", void 0);
__decorate([
    (0, schema_decorators_1.Relationship)({
        type: "SUGGESTS_NEW", producer: "newReleasePicks",
        // distinct from SUGGESTS's `fromTaste`, so the two fan-outs cannot cross-link
        keyField: "summary", recordKeyField: "freshFromTaste",
        description: "NEWLY RELEASED films matching your overall taste — currently in cinemas or fresh on streaming, " +
            "found by live web search rather than from memory. Use for \"anything new out I'd like?\"; " +
            "exclude films you've already rated.",
    })
], MovieTasteSummary.prototype, "newReleases", void 0);
exports.MovieTasteSummary = MovieTasteSummary = __decorate([
    (0, schema_decorators_1.Node)({
        // Shared/virtual, not user-OWNED in the persistence sense: like Movie/StreamingService it
        // is materialized on demand and reached FROM the scoped `(me:AssistantUser)`, so it needs
        // no from-user anchor of its own. Movie-prefixed label + edge so this realm's fan-in node
        // can't collide with another realm's summary type.
        userAnchor: false,
    })
    // The fan-IN edge, and the one join in this realm whose ANCHOR the realm does not own —
    // `AssistantUser` is a host type, so there is no class to hang a @Relationship field on.
    // keyField is the user's `id` (== the world scope key), echoed by the producer into
    // `anchorKey` so the one node links back.
    ,
    (0, schema_decorators_1.VirtualJoin)({
        anchorLabel: "AssistantUser",
        relationship: "HAS_MOVIE_TASTE_SUMMARY",
        keyField: "id",
        recordKeyField: "anchorKey",
        producer: "movieTasteSummary",
        description: "The user's film-taste summary, synthesized from every MovieRating they've recorded. One node per " +
            "user — ask for `ts.summary`. Materialized on demand and cached weekly, so it is cheap to read " +
            "repeatedly. Use it to answer \"what's my taste in film?\" / \"summarize what I like\" without " +
            "hand-scanning the ratings.",
    })
], MovieTasteSummary);
/**
 * A rating of a Movie, attributed to a PERSON in the world — the current user OR any Person
 * they've recorded a rating for (a friend, a family member). One rating per (rater, movie):
 * re-rating updates in place. Reads power "what have I rated?", "what did &lt;person&gt;
 * think of X?", the "exclude already-seen" filter, and cross-person queries like "films
 * &lt;A&gt; and &lt;B&gt; would both like".
 *
 * Every rating hangs off a Person by `(Person)-[:RATED]->(MovieRating)`. The current user's
 * own ratings anchor on their AssistantUser node, which ALSO carries the `Person` label — so
 * the SAME edge and direction serve "me" and everyone else, and a two-person query is one
 * uniform join:
 *
 * ```cypher
 * MATCH (a:Person)-[:RATED]->(ra:MovieRating), (b:Person)-[:RATED]->(rb:MovieRating)
 * WHERE ra.imdbId = rb.imdbId AND ra.rating >= 8 AND rb.rating >= 8
 * ```
 */
let MovieRating = class MovieRating extends runtime_types_1.Entity {
};
exports.MovieRating = MovieRating;
__decorate([
    (0, schema_decorators_1.Id)()
], MovieRating.prototype, "ratingKey", void 0);
__decorate([
    (0, schema_decorators_1.Property)({ type: "int" })
], MovieRating.prototype, "rating", void 0);
__decorate([
    (0, schema_decorators_1.Relationship)({
        type: "OF", producer: "movieByImdbId",
        keyField: "imdbId", recordKeyField: "imdbId",
        description: "The film a rating is OF — its canonical Movie metadata, fetched by imdbId. Traverse this to go " +
            "from a MovieRating to the full film record (title, year, genre, director, plot, imdbRating) and " +
            "onward to its reviews or streaming options: (rt:MovieRating)-[:OF]->(m:Movie). One Movie per rating.",
    })
], MovieRating.prototype, "movie", void 0);
__decorate([
    (0, schema_decorators_1.Relationship)({
        type: "SIMILAR_TO", producer: "similarMovies",
        keyField: "title", recordKeyField: "similarTo",
        description: "Films similar to one the user rated, from the assistant's own film knowledge (not an API). " +
            "Ratings are on a 1–10 scale, so anchor recommendations on the films the user LOVED, not merely " +
            "watched: filter `WHERE rt.rating >= 8` (8+/10) — a low-rated film is a negative signal, not a " +
            "\"more like this\". Each suggestion resolves to its imdbId so it dedupes against already-rated " +
            "films; exclude everything the user has seen with a NOT EXISTS over their MovieRating imdbIds, " +
            "and rank by how many loved films point at each candidate (`count(*) DESC`).",
    })
], MovieRating.prototype, "similar", void 0);
exports.MovieRating = MovieRating = __decorate([
    (0, schema_decorators_1.Node)({
        // For the CURRENT user the framework emits `(me)-[:RATED]->` automatically on create_entry.
        // Attributing a rating to ANOTHER person is done by seeding or a future skill that resolves
        // the person (by email) and links `(person)-[:RATED]->(r)`.
        userAnchor: { predicate: "RATED", direction: "from-user" },
    })
], MovieRating);
/**
 * One film the current user wants to see. This is a REAL persisted node, reached through
 * `(me:AssistantUser)-[:WANTS_TO_SEE]->(entry:MovieWatchlistEntry)`. Film metadata is copied
 * onto the entry for fast list rendering; the virtual `OF` hop resolves the canonical Movie
 * from IMDb when a query needs the full movie graph.
 */
let MovieWatchlistEntry = class MovieWatchlistEntry extends runtime_types_1.Entity {
};
exports.MovieWatchlistEntry = MovieWatchlistEntry;
__decorate([
    (0, schema_decorators_1.Id)()
], MovieWatchlistEntry.prototype, "watchlistKey", void 0);
__decorate([
    (0, schema_decorators_1.Property)({ type: "int" })
], MovieWatchlistEntry.prototype, "year", void 0);
__decorate([
    (0, schema_decorators_1.Relationship)({
        type: "OF", producer: "movieByImdbId",
        keyField: "imdbId", recordKeyField: "imdbId",
        description: "The canonical Movie this saved-list entry refers to. The watchlist node and WANTS_TO_SEE edge " +
            "are persisted; this OF hop resolves full IMDb-backed film metadata on demand.",
    })
], MovieWatchlistEntry.prototype, "movie", void 0);
exports.MovieWatchlistEntry = MovieWatchlistEntry = __decorate([
    (0, schema_decorators_1.Node)({ userAnchor: { predicate: "WANTS_TO_SEE", direction: "from-user" } })
], MovieWatchlistEntry);
/**
 * An INDIVIDUAL published review of a film — one node PER review (many per film): its url,
 * headline, the outlet, the critic, a representative excerpt, and a normalized score.
 *
 * VIRTUAL: found on demand by an LLM WITH WEB SEARCH (producer `movieReviews`), never
 * stored. A PROMPTED, TOOL-GROUNDED edge that returns this type directly — the LLM produces
 * these fields (no OMDb resolve). Reach it from a Movie:
 *
 * ```cypher
 * MATCH (m:Movie)-[:HAS_REVIEW]->(r:MovieReview)
 * RETURN r.title, r.url, r.publication, r.score ORDER BY r.score DESC
 * ```
 */
let MovieReview = class MovieReview extends runtime_types_1.Entity {
};
exports.MovieReview = MovieReview;
__decorate([
    (0, schema_decorators_1.Id)()
], MovieReview.prototype, "url", void 0);
__decorate([
    (0, schema_decorators_1.Property)({ type: "number" })
], MovieReview.prototype, "score", void 0);
exports.MovieReview = MovieReview = __decorate([
    (0, schema_decorators_1.Node)({ userAnchor: false })
], MovieReview);
