Terms

Different API platforms use different terms to describe the same thing. So in this document I’ll use the following terms and definitions:

- Aircraft: aerial objects (planes, helocopters, etc)
- Flight: a trip by an Aircraft.
- State Vector: the time & position & velocity & etc. for **Flight** at a given time.

Problems I ran into

- Scattered Data
    - Types of information
        - State vectors - latest list of flights. Important fields: position
        - Departure & Destination code & time
            - AeroDataBox
        - ***All state vectors for an active flight***
        - Airports data (geo location, name, code, etc)
            - Using https://ourairports.com/data/
            - AeroDataBox
    - Problem: missing departure and/or destination data from Open Sky
    - Tried fetching it via /flights during refresh, but they only allow fetching flights at a 2 hour interval, and from logs each fetch only got like 5-30 flights, leaving the majority of states without departure and destination.
- 6 PM. Problem with Open Sky API in general: 429 Too Many Requests
    - Switching to ADBS Exchange
- Flight marker interaction with react three fiber. solution: switch to [deck.gl](http://deck.gl) with maplibre
- Departure & Arrival location reversed from AeroDataBox compared to PlaneFinder.net
- Initially I chose react three fiber with hand-drawn maps. Couple of problems emerged
    - Flight marker onClick & onHover event not working after updating due to how react three fiber works
    - Frame rate when moving around and zooming drops when rendering thousands of flights
    - Hand-drawn world map. Not ideal. Would like it to be an actual map.
    - Solution: switched to use [deck.gl](http://deck.gl) for GPU-powered vector rendering with maplibre for displaying an actual map.
    
     
    

Data Sources

- Open Sky
    - Decent Docs
- ABS-D Exchange
    - Nearly no documentation
    - https://rapidapi.com/adsbx/api/adsbexchange-com1/playground/
- AeroDataBox
    - https://doc.aerodatabox.com/
    - https://rapidapi.com/aedbx-aedbx/api/aerodatabox/playground
    - Great Docs
    - https://rapidapi.com/aedbx-aedbx/api/aerodatabox/playground/apiendpoint_37f1f719-ef9e-4596-abf6-b3f882435e4e

Rendering libraries

- https://github.com/maplibre/maplibre-gl-js/
- https://deck.gl/examples/maplibre

Features

- Flight Map
    - Related queries
        - Get all latest flights in the form of their latest state vectors across the globe
            - 🟠 Open Sky: `/states/all`
                - Works, but often run into 429
                - No departure & destination data
            - 🟢 ABS-D Exchange (my choice)
                - No departure & destination data
    - [ ]  Flight marker hover tooltip
    - [ ]  Aircraft icon distinguished by aircraft type, altitude, etc
    - [x]  Weather Overlay: very rough implementation, using an image tile overlay from [rainviewer.com](http://rainviewer.com)
    - [ ]  Airspace Boundaries: partially implemented
- Selected Flights
    - Related Queries
        - Get flight detail, including departure & arrival location & time
            - Data source choice: GetFlight_FlightNearest by AeroDataBox
            - Reason: sooooo nice to work with
    - [x]  Flight progress indicator
    - [x]  Flight number, airline, aircraft type
    - [x]  Origin and destination airports with IATA/ICAO codes
    - [x]  Departure and arrival times (scheduled vs. actual/estimated)
    - [x]  Current altitude, speed, heading
    - [x]  Past Visual Route
    - [x]  Predicted Flight Path/Route
- Timeline
    
    Data source: https://www.adsbexchange.com/products/historical-data
    
    - [x]  Implemented data fetching from Adsd Exchange’s sample data, cached in Redis by yyyy-mm-dd-icao.
    - Due to large data size, loading data over ~2000 flights for a day will potentially cause issues in server action responses.
    - Limitations: data fetching takes a long time (10s-20s for 2000) even with cache. Needs to be optimized, both for how the data is cached & got and the shape of the data.
    - [x]  Smooth time slider & flight marker position & angle updates.
    - [ ]  Tooltip & detail sheet for flight marker

Future Features

- [ ]  Import/create airline data with image
- [ ]  Make past visual route hook up to actual data from Adsb Exchange’s History API (need to pay)

Bugs

- Visual Flight Route seems wrong sometimes
    - Root cause: mismatch between state vector data from AdsbExchange and AeroDataBox’s flight data
- Flight maker flashes when flight positions are updated from polling