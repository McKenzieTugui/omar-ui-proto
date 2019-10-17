import axios from 'axios'
import moment from 'moment'
import qs from 'qs'
import { toPoint, dmsToDd } from './mgrs'

export default {
  generateFilter(filterArr) {
    function isId(entry) {
      return entry.category === 'id';
    }
    function isSensor(entry) {
      return entry.category === 'sensor'
    }
    function isMagic(entry) {
      return entry.category === 'magicword'
    }
    function isDate(entry) {
      return entry.category === 'date'
    }
    function concatFinalQS (magicWordsQS, sensorsQS, idsQS, datesQs) {
      let arr = [magicWordsQS, sensorsQS, idsQS, datesQs]
      const result = arr.filter(word => word.length > 0);
      console.log('final filter: ', result.join(' AND '))
      return result.join(' AND ')
    }

    // Magic Words
    let magicWordsQS = this.generateDDString(filterArr.filter(isMagic))

    // Sensors
    let sensorsQS = this.generateSensorString(filterArr.filter(isSensor))

    // IDs
    let idsQS = this.generateIdString(filterArr.filter(isId))

    // Dates
    let datesQS = this.generateDateString(filterArr.filter(isDate))
    console.log('datesQS', datesQS)
    return concatFinalQS (magicWordsQS, sensorsQS, idsQS, datesQS)
  },
  generateIdString(ids) {
    let idString = ''
    for (let [index, filter] of ids.entries()) {
      let prependValue
        = (index === 0) ? ''
        : ' OR '
      idString += prependValue + `${filter.type} LIKE '%${filter.value.toUpperCase()}%'`
    }
    return (idString.length > 0) ? `(${idString})` : ''
  },
  generateSensorString(sensors) {
    let sensorString = ''
    for (let [index, filter] of sensors.entries()) {
      let prependValue
        = (index === 0) ? ''
        : ' OR '
      sensorString += prependValue + `${filter.type} LIKE '%${filter.value.toUpperCase()}%'`
    }
    return (sensorString.length > 0) ? `(${sensorString})` : ''
  },
  generateDateString(dates) {
    let dateString = ''
    const sa = 'acquisition_date'
    const si = 'ingest_date'
    let gtOperator = '>=', ltOperator = '<='

    console.log('Dates string to generate', dates)
    // Range
    for (let [index, dateFilter] of dates.entries()) {
      console.log('index: ', index, 'dateFilter: ', dateFilter)

      let prependValue
        = (index === 0) ? ''
        : ' OR '

      if (dateFilter.type === 'range') {
        // check to see which date is first.  Order matters and the UI could produce a backwards range.
        let firstDate
          = (moment(dateFilter.value[0]).isBefore(dateFilter.value[1])) ? dateFilter.value[0]
          : dateFilter.value[1]

        let secondDate
          = (moment(dateFilter.value[0]).isBefore(dateFilter.value[1])) ? dateFilter.value[1]
          : dateFilter.value[0]

        dateString += prependValue + `${si} >= '${firstDate}' AND ${si} <= '${secondDate}'`
      }

      // dateString += prependValue + `${filter.type} LIKE '%${filter.value.toUpperCase()}%'`
    }
    return (dateString.length > 0) ? `(${dateString})` : ''

  },
  generateDDString(magicWords) {
    let ddPattern = /(\-?\d{1,2}[.]?\d*)[\s+|,?]\s*(\-?\d{1,3}[.]?\d*)/
    let dmsPattern = /(\d{1,2})[^\d]*(\d{2})[^\d]*(\d{2}[.]?\d*)[^\d]*\s*([n|N|s|S])[^\w]*(\d{1,3})[^\d]*(\d{2})[^d]*(\d{2}[.]?\d*)[^\d]*\s*([e|E|w|W])/
    let mgrsPattern = /(\d{1,2})([a-zA-Z])[^\w]*([a-zA-Z])([a-zA-Z])[^\w]*(\d{5})[^\w]*(\d{5})/

    let lat, lng = null, magicWordString = ''

    for (let [index, filter] of magicWords.entries()) {
      let prependValue
        = (index === 0) ? ''
        : ' OR '

      // DD
      if (filter.value.match(ddPattern)) {
        lat = parseFloat(RegExp.$1);
        lng = parseFloat(RegExp.$2);
        magicWordString += prependValue + 'INTERSECTS(ground_geom,POINT(' + lng + '+' + lat + '))'
      }

      // DMS
      else if (filter.value.match(dmsPattern)) {
        lat = dmsToDd( RegExp.$1, RegExp.$2, RegExp.$3, RegExp.$4 )
        lng = dmsToDd( RegExp.$5, RegExp.$6, RegExp.$7, RegExp.$8 )
        magicWordString += prependValue + 'INTERSECTS(ground_geom,POINT(' + lng + '+' + lat + '))'
      }

      // MGRS
      else if (filter.value.match(mgrsPattern)) {
        let coords = toPoint(RegExp.$1 + RegExp.$2 + RegExp.$3 + RegExp.$4 + RegExp.$5 + RegExp.$6)
        lat = coords[1]
        lng = coords[0]
        magicWordString += prependValue + 'INTERSECTS(ground_geom,POINT(' + lng + '+' + lat + '))'
      }

      // Title
      else {
        magicWordString += prependValue + `image_id LIKE '%${filter.value.toUpperCase()}%'`
      }
    }
    return (magicWordString.length > 0) ? `(${magicWordString})` : ''
  },
  WFSQuery( startIndex = 0, maxFeatures = 30, filter = '') {
    let baseUrl = 'https://omar-dev.ossim.io/omar-wfs/wfs?&'

    const wfsParams = {
      maxFeatures: maxFeatures,
      outputFormat: 'JSON',
      request: 'GetFeature',
      service: 'WFS',
      resultType: 'results',
      startIndex: startIndex,
      typeName: 'omar:raster_entry',
      version: '1.1.0',
      sortBy: 'acquisition_date :D',
    }

    // return the promise so it can be asynced and reused throughout the app
    return axios.get(baseUrl + qs.stringify(wfsParams) + '&filter=' + encodeURI(filter) )
  },
  initialVideoQuery() {
    let baseUrl = 'https://omar-dev.ossim.io/omar-wfs/wfs?'
    const filter = ''

    // resultType: 'hits' for total results
    const wfsParams = {
      service: 'WFS',
      version: '1.1.0',
      request: 'GetFeature',
      typeName: 'omar:video_data_set',
      filter: filter,
      resultType: 'results',
      outputFormat: 'JSON'
    }

    const url = baseUrl + qs.stringify(wfsParams)

    return axios
      .get(url)
      .then((res) => {
        // Strip everything away leaving filename
        // Because regex is the devil and this is cleaner
        // split divides url by /, pop returns last, replace modifies filetype
        const videoNameMp4 = res.data.features[0].properties.filename.split('/').pop().replace(/mpg/i, 'mp4')

        // Create a short file name (no file extension)
        // used for screenshot naming
        this.videoName = videoNameMp4.split('.').slice(0, -1).join('.')

        // Build final url and append to response keeping unified object intact
        res.data.features[0].properties.videoUrl = this.videoUrl = 'https://omar-dev.ossim.io/videos/' + videoNameMp4
        console.log('video res', res.data.features)
        return res
      })
  }
}