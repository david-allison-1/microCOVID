import i18n from 'i18n'
import countries from 'i18n-iso-countries'
import React, { useEffect, useState } from 'react'
import { ToggleButton } from 'react-bootstrap'
import { Typeahead } from 'react-bootstrap-typeahead'
import { Trans, useTranslation } from 'react-i18next'

import ControlLabel from './controls/ControlLabel'
import { LocationPrevalenceDetails } from './prevalence/LocationPrevalenceDetails'
import { ManualPrevalenceDetails } from './prevalence/ManualPrevalenceDetails'
import { CalculatorData } from 'data/calculate'
import 'components/calculator/styles/PrevalenceControls.scss'

interface Option {
  label: string
  value: string
}

export interface Location {
  label: string
  iso3: string | null
  population: string
  casesPastWeek: number
  casesIncreasingPercentage: number
  positiveCasePercentage: number | null
  topLevelGroup: string | null
  subdivisions: string[]
  incompleteVaccinations: number | null
  completeVaccinations: number | null
  unvaccinatedPrevalenceRatio: number | null
  averageFullyVaccinatedMultiplier: number | null
  updatedAt: string
}

interface PrevalanceData {
  population: string
  casesPastWeek: number
  casesIncreasingPercentage: number
  positiveCasePercentage: number | null
  prevalanceDataDate: Date
  percentFullyVaccinated: number | null
  unvaccinatedPrevalenceRatio: number | null
  averageFullyVaccinatedMultiplier: number | null
}

export function dataForLocation(locationData: Location): PrevalanceData {
  if (locationData) {
    const population = Number(locationData.population.replace(/[^0-9.e]/g, ''))

    return {
      population: locationData.population,
      casesPastWeek: locationData.casesPastWeek,
      casesIncreasingPercentage:
        Math.round(locationData.casesIncreasingPercentage * 10) / 10,
      positiveCasePercentage:
        locationData.positiveCasePercentage === null
          ? null
          : Math.round(locationData.positiveCasePercentage * 10) / 10,
      prevalanceDataDate: new Date(locationData.updatedAt),
      percentFullyVaccinated: locationData.completeVaccinations
        ? Math.round((locationData.completeVaccinations / population) * 100)
        : null,
      unvaccinatedPrevalenceRatio: locationData.unvaccinatedPrevalenceRatio,
      averageFullyVaccinatedMultiplier:
        locationData.averageFullyVaccinatedMultiplier,
    }
  }

  return {
    population: '',
    casesPastWeek: 0,
    casesIncreasingPercentage: 0,
    positiveCasePercentage: 0,
    prevalanceDataDate: new Date(),
    percentFullyVaccinated: null,
    unvaccinatedPrevalenceRatio: null,
    averageFullyVaccinatedMultiplier: null,
  }
}

const isFilled = (val: string): boolean => {
  return val !== null && val !== undefined && val !== ''
}

const isTopLocation = (
  val: string,
  Locations: { [key: string]: Location },
): boolean => {
  return isFilled(val) && !!Locations[val]
}

export const PrevalenceControls: React.FunctionComponent<{
  data: CalculatorData
  setter: (newData: CalculatorData) => void
}> = ({ data, setter }): React.ReactElement => {
  const [Locations, setLocations] = useState({} as { [key: string]: Location })
  const getLocations = () => {
    return fetch('location.json', {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    })
      .then(function (response) {
        console.log(response)
        return response.json()
      })
      .then(function (myJson) {
        console.log(myJson)
        setLocations(myJson)
      })
  }
  useEffect(() => {
    getLocations()
  }, [])
  const { t } = useTranslation()
  for (const iso_code of Object.keys(i18n.services.resourceStore.data)) {
    countries.registerLocale(
      require('i18n-iso-countries/langs/' + iso_code + '.json'), // eslint-disable-line @typescript-eslint/no-var-requires
    )
  }
  const locationGroups: { [key: string]: Array<string> } = {}
  for (const key in Locations) {
    const location = Locations[key]
    if (location.topLevelGroup !== null) {
      let members = locationGroups[location.topLevelGroup]
      if (members === undefined) {
        members = []
        locationGroups[location.topLevelGroup] = members
      }
      members.push(key)
    }
  }

  const setLocationData = (
    topLocation: string,
    subLocation: string,
    subSubLocation: string,
  ) => {
    const locationKey = subSubLocation || subLocation || topLocation
    setter({
      ...data,
      ...dataForLocation(Locations[locationKey]),
      topLocation,
      subLocation,
      subSubLocation,
    })
  }

  const setManualPrevalenceData = (isManualEntry: boolean) => {
    setIsManualEntryCurrently(isManualEntry)
    const useManualEntry = isManualEntry ? 1 : 0

    if (isManualEntry) {
      setter({
        ...data,
        useManualEntry,
      })
    } else if (!isManualEntry) {
      // Going back to location mode. Reset location data so that details match the selected country/state and region.
      const topLocation = data.topLocation
      const subLocation = data.subLocation
      const subSubLocation = data.subSubLocation
      const locationKey = subSubLocation || subLocation || topLocation
      setter({
        ...data,
        ...dataForLocation(Locations[locationKey]),
        useManualEntry,
      })
    }
  }

  // If a stored location exists, load latest data for that location.
  useEffect(() => {
    if (
      !data.useManualEntry &&
      (isFilled(data.subSubLocation || '') ||
        isFilled(data.subLocation) ||
        isTopLocation(data.topLocation, Locations))
    ) {
      setLocationData(
        data.topLocation,
        data.subLocation,
        data.subSubLocation || '',
      )
    }
    // Intentionally not depending on data so that this runs once on mount.
    // eslint-disable-next-line
  }, [])

  let subPromptType = 'country_or_regions'
  if (isTopLocation(data.topLocation, Locations)) {
    if (data.topLocation.startsWith('US_')) {
      if (Locations[data.topLocation].label === 'Louisiana') {
        subPromptType = 'US-LA'
      } else if (Locations[data.topLocation].label === 'Alaska') {
        subPromptType = 'US-AK'
      } else {
        subPromptType = 'US'
      }
    } else if (data.topLocation === 'Canada') {
      subPromptType = 'CA'
    }
  }

  const showSubLocation =
    isTopLocation(data.topLocation, Locations) &&
    Locations[data.topLocation].subdivisions.length > 1

  const showSubSubLocation =
    isFilled(data.subLocation) &&
    Locations[data.subLocation].subdivisions.length > 1

  const locationSet =
    !data.useManualEntry && isTopLocation(data.topLocation, Locations)

  const [isManualEntryCurrently, setIsManualEntryCurrently] = useState<boolean>(
    !!data.useManualEntry,
  )

  const [detailsOpen, setDetailsOpen] = useState(
    false || isManualEntryCurrently,
  )

  const topLocationOptions = Object.keys(locationGroups).flatMap(
    (groupName) => {
      return locationGroups[groupName].map((locKey) => {
        const country_label =
          Locations[locKey].iso3 &&
          countries.getName(Locations[locKey].iso3!, i18n.language, {
            select: 'official',
          })
            ? countries.getName(Locations[locKey].iso3!, i18n.language, {
                select: 'official',
              })
            : Locations[locKey].label
        if (Locations[locKey].iso3! === 'GEO') {
          // Georgia the country
          return {
            label:
              country_label +
              ' (' +
              t('calculator.select_location_label_clarifications.country') +
              ')',
            value: locKey,
          }
        } else if (locKey === 'US_13') {
          // Georgia the US state
          return {
            label:
              country_label +
              ' (' +
              t('calculator.select_location_label_clarifications.US_state') +
              ')',
            value: locKey,
          }
        }
        return { label: country_label, value: locKey }
      })
    },
  )

  const locationOptionCompareFn = (
    a: { label: string; value: string },
    b: { label: string; value: string },
  ) => a.label.localeCompare(b.label)

  // reorder the list according to the current locale, but keep
  // English as-is to make sure US states remain at the top
  if (i18n.language !== 'en-US') {
    topLocationOptions.sort(locationOptionCompareFn)
  }

  const selectedTopLocation = topLocationOptions.find(
    (option) => option.value === data.topLocation,
  )

  const subLocationOptions = !showSubLocation
    ? []
    : Locations[data.topLocation].subdivisions
        .map((locKey) => {
          // We assume that sublocation names are either localized or don't have
          // proper localized names. This is not always true, but the overhead of
          // providing locallizations for them would not be worth it.
          return { label: Locations[locKey].label, value: locKey }
        })
        .sort(locationOptionCompareFn)
  const selectedSubLocation = subLocationOptions.find(
    (option) => option.value === data.subLocation,
  )

  const subSubLocationOptions = !showSubSubLocation
    ? []
    : Locations[data.subLocation].subdivisions
        .map((locKey) => {
          return { label: Locations[locKey].label, value: locKey }
        })
        .sort(locationOptionCompareFn)
  const selectedSubSubLocation = subSubLocationOptions.find(
    (option) => option.value === data.subSubLocation,
  )

  return (
    <React.Fragment>
      <header id="location">
        <Trans>calculator.location_selector_header</Trans>
      </header>
      <div className="form-group">
        <ControlLabel
          id="top-location-typeahead"
          header={t('calculator.select_location_label')}
        />
        <Typeahead
          clearButton={true}
          disabled={isManualEntryCurrently}
          highlightOnlyResult={true}
          id="top-location-typeahead"
          inputProps={{ autoComplete: 'chrome-off' }}
          onChange={(e: Option[]) => {
            if (e.length !== 1) {
              setLocationData('', '', '')
              return
            }
            setLocationData(e[0].value, '', '')
          }}
          options={topLocationOptions}
          placeholder={t('calculator.select_location_placeholder')}
          selected={
            selectedTopLocation === undefined ? [] : [selectedTopLocation]
          }
        />
      </div>
      {showSubLocation && (
        <div className="form-group">
          <ControlLabel
            id="sub-location-typeahead"
            header={t(`calculator.location_sublabel.${subPromptType}`)}
          />
          <Typeahead
            clearButton={true}
            disabled={isManualEntryCurrently}
            highlightOnlyResult={true}
            id="sub-location-typeahead"
            inputProps={{ autoComplete: 'chrome-off' }}
            onChange={(e: Option[]) => {
              if (e.length !== 1) {
                setLocationData(data.topLocation, '', '')
                return
              }
              setLocationData(data.topLocation, e[0].value, '')
            }}
            options={subLocationOptions}
            placeholder={t(`calculator.location_subprompt.${subPromptType}`)}
            selected={
              selectedSubLocation === undefined ? [] : [selectedSubLocation]
            }
          />
        </div>
      )}
      {showSubSubLocation && (
        <div className="form-group">
          <ControlLabel
            id="sub-location-typeahead"
            header={t(`calculator.location_subsublabel.${subPromptType}`)}
          />
          <Typeahead
            clearButton={true}
            disabled={isManualEntryCurrently}
            highlightOnlyResult={true}
            id="sub-sub-location-typeahead"
            inputProps={{ autoComplete: 'chrome-off' }}
            onChange={(e: Option[]) => {
              if (e.length !== 1) {
                setLocationData(data.topLocation, data.subLocation, '')
                return
              }
              setLocationData(data.topLocation, data.subLocation, e[0].value)
            }}
            options={subSubLocationOptions}
            placeholder={t(`calculator.location_subsubprompt.${subPromptType}`)}
            selected={
              selectedSubSubLocation === undefined
                ? []
                : [selectedSubSubLocation]
            }
          />
        </div>
      )}
      <span>
        <ToggleButton
          id="switchBetweenManualDataAndLocationSelection"
          name={t('calculator.switch_button.select_location')}
          type="checkbox"
          checked={isManualEntryCurrently}
          value="1"
          variant="link"
          className="text-muted"
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            setManualPrevalenceData(e.currentTarget.checked)
          }}
        >
          <span id="switchBetweenManualDataAndLocationSelectionText">
            {t('calculator.switch_button.enter_data_manually')}
          </span>
        </ToggleButton>
      </span>
      {isManualEntryCurrently ? (
        <ManualPrevalenceDetails
          id="prevalence-details"
          data={data}
          setter={setter}
        />
      ) : (
        <LocationPrevalenceDetails
          id="prevalence-details"
          data={data}
          header={t('calculator.prevalence.details_header')}
          open={detailsOpen}
          setter={setDetailsOpen}
          hide={isManualEntryCurrently}
          locationSet={locationSet}
        />
      )}
    </React.Fragment>
  )
}
