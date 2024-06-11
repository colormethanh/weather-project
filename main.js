console.log("let's code");

let weatherComponent;

/**
 * Helper functions
 */
const APIKEY = "deecee58f4daa55a503c09ae97c1d3ab";

const fetchData = async function (url) {
  const resp = await fetch(url);
  const data = await resp.json();
  return data;
}

const getLatLonData = async function (cityName) {
  const url = `http://api.openweathermap.org/geo/1.0/direct?q=${cityName}&limit=1&appid=${APIKEY}`;
  const data = await fetchData(url);

  // If location is not found
  if(data.length === 0) return -1;

  const {name, lat, lon} = data[0];
  return {name, lat, lon};
}; 

const getCurrentWeatherData = async function (lon, lat, unit="imperial") {
  const returnData = {}
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=${unit}&appid=${APIKEY}`
  const data = await fetchData(url);
  returnData.name = data.name;
  returnData.temp = data.main.temp;
  const {description, icon} = data.weather[0];
  const output = {...returnData, weather: description, iconCode: icon};
  return output;
};

const getFiveDayWeatherData = async function (lon, lat, units="imperial") {
  const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=${units}&appid=${APIKEY}`;
  const data = await fetchData(url);
  return formatFiveDayData(data.list);
};

const formatFiveDayData = function(data) {
  let dateSeparatedArr = [];
  let dateArr = []

  /**
   * Formatting logic:
   * Loop through data array (40 items where every 8 items is 1 day) while keep track of number items traversed
   * We append each item to a temp array (dateArr)
   * Everytime we've traversed 8 items (1 day) we push the temp array to the output array (dateSeparatedArr)
   */
  data.forEach((itm, index) => {
    const itmCt = index + 1;
    // if itemCt is devisable by 8, it means it is the last itm for that day 
    if ((itmCt % 8) === 0){
      dateArr.push(itm);
      dateSeparatedArr.push(dateArr);
      dateArr = [];
      return
    }
    dateArr.push(itm);
    return
  });
  
  /**
   * Formatting logic:
   * Now that we have an array where each day is an index inside an array,
   * the goal now is to reduce each index in the day ARRAY to be a single day OBJECT
   * on every loop we += item temp to the temp of the accumulator (which is an obj), to be averaged later
   * The first index of the day is used to get the day of the week and weather condition
   * The last index of the day is used to calculated the average temp of that day
   * 
   * from: dateSeparatedArray = [[day1data, day1data, day1data], [day2data, day2data], ...]
   * to: dateSeparatedArray  = [{day1Obj}, {day2Obj}, ...]
   */
  dateSeparatedArr = dateSeparatedArr.map((dayArr) => {

    return dayArr.reduce((accumulator, itm, dayIndex) => {
      accumulator.temp += itm.main.temp;
      
      // get Day of week, weather icon, and weather condition
      if (dayIndex === 0) {
        const datesStrings = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const date = new Date(itm.dt_txt);
        const dayOfWk = date.getDay();
        accumulator.day = datesStrings[dayOfWk];
        accumulator.weather = itm.weather[0].description;
        accumulator.iconCode = itm.weather[0].icon;
      };

      // if item is last item of day calc avg temp;
      if (dayIndex === 7) {
        const avgTemp = accumulator.temp / 8;
        const roundedTemp = Math.ceil(avgTemp * 100) / 100;
        accumulator.temp = roundedTemp;
      };
      return accumulator;
    }, {"temp": 0, "weather": "", "iconCode": "", "day":""})
  })
  return dateSeparatedArr;
};

const updateWeatherPanel = async function(component) {
  const componentTemplate = await component.getTemplate();
  $(".weather-panel").replaceWith(componentTemplate);
};

const toggleModal = function(title, body) {
  $(".modal-title").text(title);
  $(".modal-body").html(`<p>${body}</p>`);
  $("#project-modal").modal("toggle");
}

const initSetDefaultBtn = function() {
  $("#set-default-btn").on("click", (event) => {
    event.preventDefault();
    console.log("setDefaultBtn clicked");
    console.log(weatherComponent.name);
    localStorage.setItem("WEATHERPROJECT", JSON.stringify({"name": weatherComponent.name}));
    $("#default-city-text").text(`Default city: ${weatherComponent.name}`);
    toggleModal("Success!", "New Default location has been set!");
  });

  return;
};

const handleGetCurrentLocation = async function () { 
  const geolocation = navigator.geolocation
  if (!geolocation) return alert("Geolocation is not supported. Sorry!");
  
  const onSuccess = async function (pos) {
    const {longitude, latitude}  = pos.coords
    const {name} = await getCurrentWeatherData(longitude, latitude);
    handleSubmit(name, {"lon": longitude, "lat": latitude, "name": name});
  }

  const onError = function () {
    alert("Oh No! Something went wrong finding your geolocation!");
  } 

  geolocation.getCurrentPosition(onSuccess, onError, {enableHighAccuracy:true});
};

const handleSubmit = async function (searchValue, locationData = null) {
  const {lon, lat, name} = locationData ? locationData : await getLatLonData(searchValue);
  
  if (!name) return alert("Error: Location not found");

  weatherComponent = new WeatherComponent(lon, lat, name);
 
  await updateWeatherPanel(weatherComponent);
  initSetDefaultBtn();
};

/**
 * My Class
 */
class WeatherComponent {
  constructor(lon, lat, name) {
    this.lat = lat;
    this.lon = lon;
    this.name = name;
    this.id = new Date().getTime();
    this.curTemp = null;
    this.curWeather = null;
    this.iconCode = null;
    this.fiveDayData = null;
  };

  async fetchCurData() {
    const {temp, weather, iconCode}  = await getCurrentWeatherData(this.lon, this.lat);
    this.curTemp = temp;
    this.curWeather = weather;
    this.iconCode = iconCode;
    return 1;
  };

  async fetchFiveDayData() {
    const data = await getFiveDayWeatherData(this.lon, this.lat);
    this.fiveDayData = data;
  };

  getFiveDayWeatherPanelChildren() {
    let template = ""
    this.fiveDayData.forEach((day) => {
      const box = `
        <div class="five-day-box col"> 
          <div class="weather-condition-sm">${day.weather}</div>
          <div class="weather-degree-sm"> ${day.temp}</div>
          <img
                  src="https://openweathermap.org/img/wn/${day.iconCode}@2x.png"
                  alt="${day.weather} icon"
                  class="cur-weather-icon"
                />
          <div class="weather-day"> ${day.day}</div>
        </div> 
      `
      template += box;
    })

    return template;
  }

  async getFiveDayPanelTemplate() {
    if (!this.fiveDayData) await this.fetchFiveDayData();

    return `
      <div class="five-day-panel row flex-column flex-md-row text-center">
         
          ${this.getFiveDayWeatherPanelChildren()}
        
      </div>
    `
  };

  async getTemplate() {
    if (!this.curTemp || !this.curWeather || !this.iconCode) {await this.fetchCurData()};

    return `
            <div class="weather-panel" id="${this.id}">
              <div
                class="cur-weather-panel row mb-3 d-flex justify-content-center  "
              >
                <div class="d-flex flex-row justify-content-around text-center weather-panel-inner w-75"> 
                  <div class="cur-weather-text">
                    <div class="weather-degree">${this.curTemp}°</div>
                    <div class="weather-city">${this.name}</div>
                    <div class="weather-condition">${this.curWeather}</div>
                  </div>
                  <img
                    src="https://openweathermap.org/img/wn/${this.iconCode}@2x.png"
                    alt="${this.weather} icon"
                    class="cur-weather-icon"
                  />
                </div>
            </div>
            ${await this.getFiveDayPanelTemplate()}
            <div class="row"> <a id="set-default-btn" href="#" type="button"> Set as default </a> </div>
          </div>
            `
          };
};

/**
 * Event Handlers / On StartUp
 */
$(async () => {

  $("#search-form").on("submit", (event) => {
    event.preventDefault();

    const searchValue = event.target[0].value;

    if(searchValue === "") return alert("oops looks like the search bar is empty!");

    handleSubmit(searchValue);

    $("#search-input").val("");
  });

  $("#cur-loc-btn").on("click", async () => {
    await handleGetCurrentLocation();
  });

  if(localStorage.getItem("WEATHERPROJECT")) {
    const defaultCityName = JSON.parse(localStorage.getItem("WEATHERPROJECT")).name
    handleSubmit(defaultCityName);
    $("#default-city-text").text(`Default city: ${defaultCityName}`);
  } else {
    toggleModal("Welcome!", `Enter a city name in the text input to view that city's weather. <br /> or <br/> Click the <i class="bi bi-geo-alt"></i> button in the navbar to get your current location's weather data`);
  };
});




