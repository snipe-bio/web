import json
import numpy as np
import hashlib
import random
from enum import Enum, auto
import pandas as pd
from sklearn.linear_model import LinearRegression


class SigType(Enum):
    """
    Enumeration representing different types of signatures.

    This enum defines the various types of signatures that can be used
    by snipe. It includes:

    - SAMPLE: Represents a signature for a sample.
    - GENOME: Represents a signature for a genome.
    - AMPLICON: Represents a signature for an amplicon.

    Usage:
        sig_type = SigType.SAMPLE
    """

    SAMPLE = auto()
    GENOME = auto()
    AMPLICON = auto()


class RefStats:
    """
    A class to manage and store reference-specific statistical data.

    This class provides a structured way to handle various statistical metrics
    related to a specific reference (e.g., genome, amplicon). It includes methods
    for setting and retrieving individual stats, as well as functionality to
    export all stats and verify their completeness.

    Attributes:
        ref_name (str): The name of the reference for which stats are being collected.
        stats (dict): A dictionary containing all the statistical metrics.

    Methods:
        all_stats(): Returns all stats as a dictionary.
        check_all_stats(): Verifies that all stats have been set.
        __str__(): Returns a JSON string representation of all stats.

    Properties:
        Various properties for getting and setting individual statistical metrics.
        Each metric has a getter and setter method.

    Usage:
        ref_stats = RefStats("reference_1")
        ref_stats.coverage_index = 0.95
        ref_stats.unique_hashes = 1000
        # ... set other stats ...
        print(ref_stats.all_stats())
    """

    def __init__(self, ref_name):
        self.ref_name = ref_name
        self.stats = self._create_ref_amplicon_stats_template(ref_name)

    def _create_ref_amplicon_stats_template(self, ref_name):
        return {
            f"{ref_name}_coverage_index": -1.0,
            f"{ref_name}_unique_hashes": -1,
            f"{ref_name}_total_abundance": -1,
            f"{ref_name}_mean_abundance": -1.0,
            f"{ref_name}_median_abundance": -1.0,
            f"{ref_name}_median_trimmed_coverage_index": -1.0,
            f"{ref_name}_median_trimmed_unique_hashes": -1,
            f"{ref_name}_median_trimmed_total_abundance": -1,
            f"{ref_name}_median_trimmed_mean_abundance": -1.0,
            f"{ref_name}_median_trimmed_median_abundance": -1.0,
            f"non_{ref_name}_unique_hashes": -1,
            f"non_{ref_name}_total_abundance": -1,
            f"non_{ref_name}_mean_abundance": -1.0,
            f"non_{ref_name}_median_abundance": -1.0,
        }

    @property
    def coverage_index(self):
        return self.stats[f"{self.ref_name}_coverage_index"]

    @coverage_index.setter
    def coverage_index(self, value):
        self.stats[f"{self.ref_name}_coverage_index"] = value

    # ... [other property getters and setters remain unchanged] ...

    def all_stats(self):
        """
        Returns all stats as a dictionary.

        Raises:
            ValueError: If not all stats have been set.

        Returns:
            dict: A dictionary containing all the statistical metrics.
        """
        if len(self.stats) != len(
            self._create_ref_amplicon_stats_template(self.ref_name)
        ):
            raise ValueError("All stats must be set before accessing exporting them.")
        return self.stats

    def check_all_stats(self):
        """
        Verifies that all stats have been set.

        Raises:
            ValueError: If any stats are missing (still set to the default -1 value).
        """
        missing_stats = [k for k, v in self.stats.items() if v == -1]
        # missing stats excluding any abundance, or coveragem or unique_hashes
        missing_stats = [
            x
            for x in missing_stats
            if "abundance" not in x and "coverage" not in x and "unique_hashes" not in x
        ]
        if missing_stats:
            raise ValueError(f"Missing stats: {missing_stats}")

    def __str__(self):
        """
        Returns a JSON string representation of all stats.

        Returns:
            str: A formatted JSON string of all statistical metrics.
        """
        return json.dumps(self.stats, indent=4)


# -----------------


class AmpliconStats(RefStats):
    """
    A class to manage and store amplicon-specific statistical data.

    This class extends RefStats to include additional metrics specific to amplicon analysis,
    such as relative coverage index and relative abundance measures.

    Attributes:
        Inherits all attributes from RefStats and adds:
        - relative_coverage_index
        - median_trimmed_relative_coverage_index
        - relative_mean_abundance
        - median_trimmed_relative_mean_abundance

    Methods:
        Inherits all methods from RefStats and overrides:
        - all_stats(): Returns all stats, including amplicon-specific ones.

    Usage:
        amplicon_stats = AmpliconStats("amplicon_1")
        amplicon_stats.coverage_index = 0.95
        amplicon_stats.relative_coverage_index = 1.2
        # ... set other stats ...
        print(amplicon_stats.all_stats())
    """

    def __init__(self, ref_name):
        super().__init__(ref_name)

        # add relative coverage_index
        self.stats[f"{ref_name}_relative_coverage_index"] = -1.0
        self.stats[f"{ref_name}_median_trimmed_relative_coverage_index"] = -1.0

        # relative abundance
        self.stats[f"{ref_name}_relative_mean_abundance"] = -1.0
        self.stats[f"{ref_name}_median_trimmed_relative_mean_abundance"] = -1.0

    @property
    def relative_coverage_index(self):
        return self.stats[f"{self.ref_name}_relative_coverage_index"]

    @relative_coverage_index.setter
    def relative_coverage_index(self, value):
        self.stats[f"{self.ref_name}_relative_coverage_index"] = value

    @property
    def median_trimmed_relative_coverage_index(self):
        return self.stats[f"{self.ref_name}_median_trimmed_relative_coverage_index"]

    @median_trimmed_relative_coverage_index.setter
    def median_trimmed_relative_coverage_index(self, value):
        self.stats[f"{self.ref_name}_median_trimmed_relative_coverage_index"] = value

    @property
    def relative_mean_abundance(self):
        return self.stats[f"{self.ref_name}_relative_mean_abundance"]

    @relative_mean_abundance.setter
    def relative_mean_abundance(self, value):
        self.stats[f"{self.ref_name}_relative_mean_abundance"] = value

    @property
    def median_trimmed_relative_mean_abundance(self):
        return self.stats[f"{self.ref_name}_median_trimmed_relative_mean_abundance"]

    @median_trimmed_relative_mean_abundance.setter
    def median_trimmed_relative_mean_abundance(self, value):
        self.stats[f"{self.ref_name}_median_trimmed_relative_mean_abundance"] = value

    def all_stats(self):
        """
        Returns all stats as a dictionary, including amplicon-specific stats.

        This method overrides the parent class method to account for the
        additional amplicon-specific statistics.

        Raises:
            ValueError: If not all stats have been set.

        Returns:
            dict: A dictionary containing all the statistical metrics.
        """

        # todo: make it more professional
        if (
            len(self.stats)
            != len(self._create_ref_amplicon_stats_template(self.ref_name)) + 4
        ):
            raise ValueError("All stats must be set before accessing exporting them.")
        return self.stats


class SampleStats:
    """
    A class to manage and store sample-specific statistical data.

    This class provides a structured way to handle various statistical metrics
    related to a specific sample. It includes methods for setting and retrieving
    individual stats, as well as functionality to export all stats and verify
    their completeness.

    Attributes:
        sample_name (str): The name of the sample for which stats are being collected.
        stats (dict): A dictionary containing all the statistical metrics.

    Properties:
        unique_hashes (int): The number of unique hashes in the sample.
        total_abundance (int): The total abundance of the sample.
        mean_abundance (float): The mean abundance of the sample.
        median_abundance (float): The median abundance of the sample.
        median_trimmed_unique_hashes (int): The number of unique hashes after median trimming.
        median_trimmed_total_abundance (int): The total abundance after median trimming.
        median_trimmed_mean_abundance (float): The mean abundance after median trimming.
        median_trimmed_median_abundance (float): The median abundance after median trimming.
        all_stats (dict): A dictionary containing all the statistical metrics.

    Usage:
        sample_stats = SampleStats("sample_1")
        sample_stats.unique_hashes = 1000
        sample_stats.total_abundance = 10000
        # ... set other stats ...
        print(sample_stats.all_stats)
    """

    def __init__(self, sample_name):
        """
        Initialize a new SampleStats instance.

        Args:
            sample_name (str): The name of the sample for which stats are being collected.
        """
        self.sample_name = sample_name
        self.stats = self._create_sample_stats_template(sample_name)

    # TODO: remove or fix sample_name input
    def _create_sample_stats_template(self, sample_name):
        """
        Create a template dictionary for sample statistics.

        Args:
            sample_name (str): The name of the sample (unused in this method, but kept for consistency).

        Returns:
            dict: A dictionary with keys for each statistic, initialized to default values.
        """
        return {
            "unique_hashes": 0,
            "total_abundance": 0,
            "mean_abundance": 0.0,
            "median_abundance": 0.0,
            "median_trimmed_unique_hashes": 0,
            "median_trimmed_total_abundance": 0,
            "median_trimmed_mean_abundance": 0.0,
            "median_trimmed_median_abundance": 0.0,
        }

    @property
    def unique_hashes(self):
        """Get the number of unique hashes."""
        return self.stats["unique_hashes"]

    @unique_hashes.setter
    def unique_hashes(self, value):
        """
        Set the number of unique hashes.

        Args:
            value (int): The number of unique hashes.

        Raises:
            ValueError: If the value is not an integer.
        """
        if not isinstance(value, int):
            raise ValueError("unique_hashes must be an integer.")
        self.stats["unique_hashes"] = value

    @property
    def total_abundance(self):
        """Get the total abundance."""
        return self.stats["total_abundance"]

    @total_abundance.setter
    def total_abundance(self, value):
        """
        Set the total abundance.

        Args:
            value (int): The total abundance.

        Raises:
            ValueError: If the value is not an integer.
        """
        if not isinstance(value, int):
            raise ValueError("total_abundance must be an integer.")
        self.stats["total_abundance"] = value

    @property
    def mean_abundance(self):
        """Get the mean abundance."""
        return self.stats["mean_abundance"]

    @mean_abundance.setter
    def mean_abundance(self, value):
        """
        Set the mean abundance.

        Args:
            value (int or float): The mean abundance.

        Raises:
            ValueError: If the value is not a number.
        """
        if not isinstance(value, (int, float)):
            raise ValueError("mean_abundance must be a number.")
        self.stats["mean_abundance"] = float(value)

    @property
    def median_abundance(self):
        """Get the median abundance."""
        return self.stats["median_abundance"]

    @median_abundance.setter
    def median_abundance(self, value):
        """
        Set the median abundance.

        Args:
            value (int or float): The median abundance.

        Raises:
            ValueError: If the value is not a number.
        """
        if not isinstance(value, (int, float)):
            raise ValueError("median_abundance must be a number.")
        self.stats["median_abundance"] = float(value)

    @property
    def median_trimmed_unique_hashes(self):
        """Get the number of unique hashes after median trimming."""
        return self.stats["median_trimmed_unique_hashes"]

    @median_trimmed_unique_hashes.setter
    def median_trimmed_unique_hashes(self, value):
        """
        Set the number of unique hashes after median trimming.

        Args:
            value (int): The number of unique hashes after median trimming.

        Raises:
            ValueError: If the value is not an integer.
        """
        if not isinstance(value, int):
            raise ValueError("median_trimmed_unique_hashes must be an integer.")
        self.stats["median_trimmed_unique_hashes"] = value

    @property
    def median_trimmed_total_abundance(self):
        """Get the total abundance after median trimming."""
        return self.stats["median_trimmed_total_abundance"]

    @median_trimmed_total_abundance.setter
    def median_trimmed_total_abundance(self, value):
        """
        Set the total abundance after median trimming.

        Args:
            value (int): The total abundance after median trimming.

        Raises:
            ValueError: If the value is not an integer.
        """
        if not isinstance(value, int):
            raise ValueError("median_trimmed_total_abundance must be an integer.")
        self.stats["median_trimmed_total_abundance"] = value

    @property
    def median_trimmed_mean_abundance(self):
        """Get the mean abundance after median trimming."""
        return self.stats["median_trimmed_mean_abundance"]

    @median_trimmed_mean_abundance.setter
    def median_trimmed_mean_abundance(self, value):
        """
        Set the mean abundance after median trimming.

        Args:
            value (int or float): The mean abundance after median trimming.

        Raises:
            ValueError: If the value is not a number.
        """
        if not isinstance(value, (int, float)):
            raise ValueError("median_trimmed_mean_abundance must be a number.")
        self.stats["median_trimmed_mean_abundance"] = float(value)

    @property
    def median_trimmed_median_abundance(self):
        """Get the median abundance after median trimming."""
        return self.stats["median_trimmed_median_abundance"]

    @median_trimmed_median_abundance.setter
    def median_trimmed_median_abundance(self, value):
        """
        Set the median abundance after median trimming.

        Args:
            value (int or float): The median abundance after median trimming.

        Raises:
            ValueError: If the value is not a number.
        """
        if not isinstance(value, (int, float)):
            raise ValueError("median_trimmed_median_abundance must be a number.")
        self.stats["median_trimmed_median_abundance"] = float(value)

    @property
    def all_stats(self):
        """
        Get all stats as a dictionary.

        Returns:
            dict: A dictionary containing all the statistical metrics.

        Raises:
            ValueError: If not all stats have been set.
        """
        if len(self.stats) != len(self._create_sample_stats_template(self.sample_name)):
            raise ValueError(
                "All stats must be set before accessing or exporting them."
            )
        return self.stats


class Signature:
    def __init__(self, k_size: int, signature_type: SigType = SigType.SAMPLE):
        if not isinstance(signature_type, SigType):
            raise ValueError(
                f"signature_type must be an instance of SignatureType, got {type(signature_type)}"
            )

        self._k_size = k_size
        self._hashes = np.array([], dtype=np.uint64)
        self._abundances = np.array([], dtype=np.uint64)
        self._md5sum = ""
        self._scale = 0
        self._name = ""
        self._type = signature_type
        self._reference_signature = None
        self._amplicon_signatures = {}
        self.reference_stats = None
        self.amplicon_stats = {}
        self.genomic_roi_stats_data = None
        self.amplicons_roi_stats_data = {}

    def load_from_json_string(self, json_string: str):
        try:
            data = json.loads(json_string)
            return self.process_signature_data(data)
        except json.JSONDecodeError as e:
            return (
                None,
                False,
                f"Error: The provided string is not in valid JSON format. {str(e)}",
            )
        except Exception as e:
            return None, False, f"An unexpected error occurred: {e}"

    def load_from_path(self, path: str):
        try:
            with open(path, "r") as file:
                try:
                    data = json.load(file)
                    if isinstance(data, list):
                        return self.process_signature_data(data[0])
                    else:
                        return None, False, "Error: Expected a list of items in JSON."
                except json.JSONDecodeError:
                    return None, False, "Error: Incomplete or invalid JSON content."
                except IndexError:
                    return None, False, "Error: No items found in JSON."
        except FileNotFoundError:
            return None, False, f"Error: File '{path}' not found."
        except Exception as e:
            return None, False, f"An unexpected error occurred: {e}"

    def process_signature_data(self, data):
        found = False
        if not isinstance(data, list):
            data = [data]
        for d in data:
            for signature in d.get("signatures", []):
                if signature.get("ksize") == self._k_size:
                    found = True
                    self._name = d.get("name", "")
                    self._hashes = np.array(signature.get("mins", []), dtype=np.uint64)
                    self._md5sum = signature.get("md5sum", "")
                    self._scale = 18446744073709551615 // signature.get("max_hash", 1)
                    if "abundances" in signature:
                        self._abundances = np.array(
                            signature["abundances"], dtype=np.uint64
                        )
                        if len(self._hashes) != len(self._abundances):
                            return (
                                None,
                                False,
                                "Error: The number of hashes and abundances do not match.",
                            )
                    else:
                        return (
                            None,
                            True,
                            "Note: Abundance data is missing for k-mer size {self._k_size}.",
                        )
                    return None, True, "Signature loaded successfully."
        if not found:
            return None, False, "Error: k-mer size {self._k_size} not found."
        return None, True, "Signature processed successfully."

    # once we add a reference signature, we calculate all its relative metrics
    def add_reference_signature(self, reference_signature):
        if self.scale != reference_signature.scale:
            raise ValueError("scale must be the same")
        if self.k_size != reference_signature.k_size:
            raise ValueError("ksize must be the same")
        if reference_signature.type != SigType.GENOME:
            raise ValueError("Reference signature must be of type GENOME")

        ref_name = reference_signature.name

        # we only support a single reference signature at the time
        if not self._reference_signature:
            self._reference_signature = reference_signature
        else:
            raise ValueError("Reference signature is already set.")

        ref_stats = RefStats(ref_name)

        intersection_sig = self & reference_signature
        ref_stats.coverage_index = len(intersection_sig) / len(reference_signature)
        ref_stats.unique_hashes = len(intersection_sig)
        ref_stats.total_abundance = intersection_sig.total_abundance
        ref_stats.mean_abundance = intersection_sig.mean_abundance
        ref_stats.median_abundance = intersection_sig.median_abundance

        # median trimmed stats
        median_trimmed_sample_signature = self.__copy__()
        median_trimmed_sample_signature.apply_median_trim()
        median_trimmed_intersection_sig = (
            median_trimmed_sample_signature & reference_signature
        )
        ref_stats.median_trimmed_coverage_index = len(
            median_trimmed_intersection_sig
        ) / len(reference_signature)
        ref_stats.median_trimmed_unique_hashes = len(median_trimmed_intersection_sig)
        ref_stats.median_trimmed_total_abundance = (
            median_trimmed_intersection_sig.total_abundance
        )
        ref_stats.median_trimmed_mean_abundance = (
            median_trimmed_intersection_sig.mean_abundance
        )
        ref_stats.median_trimmed_median_abundance = (
            median_trimmed_intersection_sig.median_abundance
        )

        # calculate non-reference stats
        non_ref_sig = self - reference_signature

        if len(non_ref_sig) == 0:
            # set all stats to 0
            ref_stats.non_ref_unique_hashes = 0
            ref_stats.non_ref_total_abundance = 0
            ref_stats.non_ref_mean_abundance = 0.0
            ref_stats.non_ref_median_abundance = 0.0
        else:
            ref_stats.non_ref_unique_hashes = len(non_ref_sig)
            ref_stats.non_ref_total_abundance = non_ref_sig.total_abundance
            ref_stats.non_ref_mean_abundance = non_ref_sig.mean_abundance
            ref_stats.non_ref_median_abundance = non_ref_sig.median_abundance

        # make sure all stats are set
        ref_stats.check_all_stats()
        self.reference_stats = ref_stats

        return True

    def add_amplicon_signature(self, amplicon_signature, custom_name: str = None):
        # TODO: make strong action for amplicon signature name settiing
        # TODO: change custom_name to a more meaningful name
        if not self._reference_signature:
            raise ValueError(
                "Reference signature must be set before adding amplicon signatures."
            )
        if self.scale != amplicon_signature.scale:
            raise ValueError("scale must be the same")
        if self.k_size != amplicon_signature.k_size:
            raise ValueError("ksize must be the same")
        if amplicon_signature.type != SigType.AMPLICON:
            raise ValueError("Amplicon signature must be of type AMPLICON")
        amplicon_name = custom_name if custom_name else amplicon_signature.name
        # make sure there is no duplicate name or checksum
        if amplicon_name not in self._amplicon_signatures:
            # no duplicate mdsum either in dictionary values
            if amplicon_signature.md5sum not in [
                x.md5sum for x in self._amplicon_signatures.values()
            ]:
                self._amplicon_signatures[amplicon_name] = amplicon_signature
        else:
            raise ValueError("Amplicon signature is already added.")

        amplicon_stats = AmpliconStats(amplicon_name)

        amplicon_on_genome = np.intersect1d(
            self._reference_signature._hashes, amplicon_signature._hashes
        )
        if len(amplicon_on_genome) == 0:
            raise ValueError(
                f"Amplicon {amplicon_name} is not part of the reference genome."
            )
        amplicon_percentage_in_genome = len(amplicon_on_genome) / len(
            self._reference_signature
        )
        if amplicon_percentage_in_genome < 0.01:
            print(
                f"Warning: Amplicon {amplicon_name} is only {amplicon_percentage_in_genome * 100:.2f}% in the reference genome."
            )

        intersection_sig = self & amplicon_signature
        amplicon_stats.coverage_index = len(intersection_sig) / len(amplicon_signature)
        amplicon_stats.relative_coverage_index = (
            amplicon_stats.coverage_index / self.reference_stats.coverage_index
        )
        amplicon_stats.unique_hashes = len(intersection_sig)
        amplicon_stats.total_abundance = intersection_sig.total_abundance
        amplicon_stats.mean_abundance = intersection_sig.mean_abundance
        amplicon_stats.median_abundance = intersection_sig.median_abundance

        subtracted_sig = self - amplicon_signature
        amplicon_stats.non_ref_unique_hashes = len(subtracted_sig)
        amplicon_stats.non_ref_total_abundance = subtracted_sig.total_abundance
        amplicon_stats.non_ref_mean_abundance = subtracted_sig.mean_abundance
        amplicon_stats.non_ref_median_abundance = subtracted_sig.median_abundance

        amplicon_stats.relative_mean_abundance = (
            amplicon_stats.median_abundance / amplicon_stats.non_ref_mean_abundance
        )

        # median trimmed stats
        median_trimmed_sample_signature = self.__copy__()
        median_trimmed_sample_signature.apply_median_trim()
        median_trimmed_intersection_sig = (
            median_trimmed_sample_signature & amplicon_signature
        )
        amplicon_stats.median_trimmed_coverage_index = len(
            median_trimmed_intersection_sig
        ) / len(amplicon_signature)
        amplicon_stats.median_trimmed_relative_coverage_index = (
            amplicon_stats.median_trimmed_coverage_index
            / self.reference_stats.median_trimmed_coverage_index
        )
        amplicon_stats.median_trimmed_unique_hashes = len(
            median_trimmed_intersection_sig
        )
        amplicon_stats.median_trimmed_total_abundance = (
            median_trimmed_intersection_sig.total_abundance
        )
        amplicon_stats.median_trimmed_mean_abundance = (
            median_trimmed_intersection_sig.mean_abundance
        )
        amplicon_stats.median_trimmed_median_abundance = (
            median_trimmed_intersection_sig.median_abundance
        )
        amplicon_stats.median_trimmed_relative_mean_abundance = (
            amplicon_stats.median_trimmed_mean_abundance
            / self.reference_stats.median_trimmed_mean_abundance
        )

        # make sure all stats are set
        amplicon_stats.check_all_stats()

        _amplicon_final_name = custom_name if custom_name else amplicon_name

        # make sure there is no duplicate name or checksum
        if _amplicon_final_name in self.amplicon_stats:
            raise ValueError(f"Amplicon {_amplicon_final_name} is already added.")

        self.amplicon_stats[_amplicon_final_name] = amplicon_stats
        return True

    def apply_median_trim(self):
        median_abundance = np.median(self._abundances)
        mask = self._abundances >= median_abundance
        self._hashes = self._hashes[mask]
        self._abundances = self._abundances[mask]

        if not len(self._hashes):
            raise ValueError("Median trimmed signature is empty.")

        self._checksum()

    def apply_abundance_filter(self, min_abundance: int):
        mask = self._abundances >= min_abundance
        self._hashes = self._hashes[mask]
        self._abundances = self._abundances[mask]
        if not len(self._hashes):
            raise ValueError("Abundance filtered signature is empty.")
        self._checksum()

    def _checksum(self):
        md5_ctx = hashlib.md5()
        md5_ctx.update(str(self._k_size).encode("utf-8"))
        for x in self._hashes:
            md5_ctx.update(str(x).encode("utf-8"))
        self._md5sum = md5_ctx.hexdigest()
        return self._md5sum

    @property
    def scale(self):
        return self._scale

    @property
    def md5sum(self):
        return self._md5sum

    @property
    def hashes(self):
        return self._hashes

    @property
    def abundances(self):
        return self._abundances

    @property
    def name(self):
        return self._name

    @property
    def type(self):
        return self._type

    @property
    def k_size(self):
        return self._k_size

    @property
    def unique_hashes(self):
        return len(self._hashes)

    @property
    def mean_abundance(self):
        try:
            mean_value = np.mean(self._abundances)
        except ZeroDivisionError:
            raise ValueError(
                "Mean abundance cannot be calculated for an empty signature."
            )

        return mean_value

    @property
    def median_abundance(self):
        try:
            median_abundance = np.median(self._abundances)
        except ZeroDivisionError:
            raise ValueError(
                "Median abundance cannot be calculated for an empty signature."
            )

        return median_abundance

    @property
    def total_abundance(self):
        return sum(self._abundances)

    @property
    def median_trimmed_stats(self):
        median_abundance = np.median(self._abundances)
        mask = self._abundances >= median_abundance
        trimmed_abundances = self._abundances[mask]
        _total_abundance = int(sum(trimmed_abundances))
        _median = np.median(trimmed_abundances)
        _mean = np.mean(trimmed_abundances)
        _std = np.std(trimmed_abundances)
        return {
            "total": _total_abundance,
            "median": _median,
            "mean": _mean,
            "std": _std,
        }

    @property
    def abundance_stats(self):
        return {
            "total": int(np.sum(self._abundances)),
            "median": int(np.median(self._abundances)),
            "mean": int(np.mean(self._abundances)),
            "std": int(np.std(self._abundances)),
        }

    @property
    def all_stats(self):
        d = {
            "unique_hashes": self.unique_hashes,
            "total_abundance": int(self.total_abundance),
            "abundance_stats": self.abundance_stats,
            "median_trimmed_stats": self.median_trimmed_stats,
        }
        return d

    def __str__(self):
        d = {
            "k_size": self._k_size,
            "md5sum": self._md5sum,
            "hashes": len(self._hashes),
            "abundances": len(self._abundances),
            "scale": self._scale,
            "name": self._name,
            "type": f"{self._type}",
        }
        return json.dumps(d, indent=4)

    def _is_compatible_for_set_operation(self, other):
        """Check if the other signature is compatible for set operations based on its type."""
        # scale must match
        if self.scale != other.scale:
            raise ValueError("scale must be the same")

        if self.k_size != other.k_size:
            raise ValueError("ksize must be the same")

        compatible_combinations = [
            (SigType.SAMPLE, SigType.GENOME),
            (SigType.SAMPLE, SigType.SAMPLE),
            (SigType.SAMPLE, SigType.AMPLICON),
        ]

        if (self._type, other._type) not in compatible_combinations:
            raise ValueError(
                f"Signatures of type {self._type} and {other._type} are not compatible for set operations."
            )

    def __and__(self, other):
        """Intersection of two signatures, keeping hashes present in both."""
        if not isinstance(other, Signature):
            return NotImplemented
        self._is_compatible_for_set_operation(other)
        new_hashes, indices_self, indices_other = np.intersect1d(
            self._hashes, other._hashes, return_indices=True
        )
        new_abundances = self._abundances[indices_self]
        return self._create_new_signature(new_hashes, new_abundances)

    def __add__(self, other):
        """Union of two signatures, combining hashes and abundances."""
        if not isinstance(other, Signature):
            return NotImplemented

        # other must be of the same type
        if self._type != other._type:
            raise ValueError("Signatures must be of the same type.")

        # union hashes, and add abundances for same hash
        # Combine hashes and corresponding abundances
        combined_hashes = np.concatenate((self._hashes, other._hashes))
        combined_abundances = np.concatenate(
            (self._abundances, other._abundances)
        ).astype(np.uint64)

        # Use np.unique to identify unique hashes and their indices, then sum the abundances
        unique_hashes, indices = np.unique(combined_hashes, return_inverse=True)
        summed_abundances = np.bincount(indices, weights=combined_abundances).astype(
            np.uint64
        )

        return self._create_new_signature(unique_hashes, summed_abundances)

    def __radd__(self, other):
        if other == 0:
            return self
        else:
            return self.__add__(other)

    def __repr__(self):
        return f"Signature(hashes={self._hashes}, abundances={self._abundances}, type={self._type})"

    def __len__(self):
        return len(self._hashes)

    def __eq__(self, other):
        if not isinstance(other, Signature):
            return NotImplemented
        return self.md5sum == other.md5sum

    def __or__(self, other):
        """Union of two signatures, combining hashes and abundances."""
        if not isinstance(other, Signature):
            return NotImplemented
        self._is_compatible_for_set_operation(other)
        new_hashes = np.union1d(self._hashes, other._hashes)
        # For abundances, we sum them up where hashes overlap, and keep unique ones as they are.
        new_abundances = self._union_abundances(new_hashes, other)
        return self._create_new_signature(new_hashes, new_abundances)

    def __sub__(self, other):
        """Subtraction of two signatures, removing hashes in the second from the first."""
        if not isinstance(other, Signature):
            return NotImplemented
        self._is_compatible_for_set_operation(other)
        new_hashes = np.setdiff1d(self._hashes, other._hashes)
        new_abundances = self._abundances[np.isin(self._hashes, new_hashes)]
        return self._create_new_signature(new_hashes, new_abundances)

    # allow deep copy of the signature
    def __copy__(self):
        return self._create_new_signature(self._hashes.copy(), self._abundances.copy())

    def _create_new_signature(self, hashes, abundances, suffix=None):
        new_sig = Signature(self._k_size)
        new_sig._hashes = hashes
        new_sig._abundances = abundances
        new_sig._checksum()
        new_sig._scale = self._scale
        new_sig._name = f"{self._name}"
        new_sig._type = self._type
        new_sig._k_size = self._k_size
        new_sig._reference_signature = None
        new_sig._amplicon_signatures = {}
        # new_sig._reference_signature = self._reference_signature
        # new_sig._amplicon_signatures = self._amplicon_signatures
        # new_sig.reference_stats = self.reference_stats
        # new_sig.amplicon_stats = self.amplicon_stats

        if suffix:
            new_sig._name += f"_{suffix}"
        return new_sig

    def _union_abundances(self, new_hashes, other):
        """Compute abundances for the union of two signatures."""
        new_abundances = np.zeros_like(new_hashes, dtype=np.uint64)
        for i, hash_val in enumerate(new_hashes):
            if hash_val in self._hashes:
                idx = np.where(self._hashes == hash_val)[0][0]
                new_abundances[i] += self._abundances[idx]
            if hash_val in other._hashes:
                idx = np.where(other._hashes == hash_val)[0][0]
                new_abundances[i] += other._abundances[idx]
        return new_abundances

    def export_to_sourmash(self, output_path: str):
        # try import sourmash
        try:
            import sourmash
        except ImportError:
            raise ImportError("sourmash is required to export to sourmash format.")
        # create a new sourmash signature
        mh = sourmash.MinHash(
            n=0, scaled=self.scale, ksize=self.k_size, track_abundance=True
        )
        hash_to_abund = dict(zip(self.hashes, self.abundances))
        mh.set_abundances(hash_to_abund)
        # make sure extensoin is .sig, add it if not present
        if not output_path.endswith(".sig"):
            output_path += ".sig"
            print(f"Warning: Added .sig extension to the output path: {output_path}")

        finalSig = sourmash.SourmashSignature(mh, name=self.name, filename=output_path)
        with sourmash.sourmash_args.FileOutput(output_path, "wt") as fp:
            sourmash.save_signatures([finalSig], fp=fp)

        print(f"Signature exported to Sourmash format: {output_path}")

    @staticmethod
    def distribute_kmers_random(original_dict, n):
        # Initialize the resulting dictionaries
        distributed_dicts = [{} for _ in range(n)]

        # Convert the dictionary to a sorted list of tuples (k, v) by key
        kmer_list = sorted(original_dict.items())

        # Flatten the k-mer list according to their abundance
        flat_kmer_list = []
        for k, v in kmer_list:
            flat_kmer_list.extend([k] * v)

        # Shuffle the flat list to randomize the distribution
        random.shuffle(flat_kmer_list)

        # Distribute the k-mers round-robin into the dictionaries
        for i, k in enumerate(flat_kmer_list):
            dict_index = i % n
            if k in distributed_dicts[dict_index]:
                distributed_dicts[dict_index][k] += np.uint64(1)
            else:
                distributed_dicts[dict_index][k] = np.uint64(1)

        return distributed_dicts

    def split_sig_randomly(self, n):
        # Split the signature into n random signatures
        hash_to_abund = dict(zip(self.hashes, self.abundances))
        random_split_sigs = self.distribute_kmers_random(hash_to_abund, n)
        # split_sigs = [
        #     self._create_new_signature(np.array(list(x.keys()), dtype=np.uint64), np.array(list(x.values()), dtype=np.uint64), f"split_{i}")
        #     for i, x in enumerate(random_split_sigs)
        # ]
        split_sigs = [
            self._create_new_signature(
                np.fromiter(x.keys(), dtype=np.uint64),
                np.fromiter(x.values(), dtype=np.uint64),
                f"{self.name}_split_{i}",
            )
            for i, x in enumerate(random_split_sigs)
        ]
        return split_sigs

    def reset_abundance(self, new_abundance=1):
        # this function set the abundance for all hashes of the signature to a new value
        self._abundances = np.full_like(self._hashes, new_abundance)

    def select_kmers_min_abund(self, min_abundance):
        # keep only k-mers with abundance >= min_abundance
        mask = self._abundances >= min_abundance
        self._hashes = self._hashes[mask]
        self._abundances = self._abundances[mask]
        if not len(self._hashes):
            raise ValueError("No k-mers found with abundance >= min_abundance.")
        self._checksum()

    def select_kmers_max_abund(self, max_abundance):
        # keep only k-mers with abundance <= max_abundance
        mask = self._abundances <= max_abundance
        self._hashes = self._hashes[mask]
        self._abundances = self._abundances[mask]
        if not len(self._hashes):
            raise ValueError("No k-mers found with abundance <= max_abundance.")
        self._checksum()

    # return on investment ROI calculation
    def calculate_genomic_roi(self, n=30):
        # check if the signature has a reference signature
        if not self._reference_signature:
            _err = "Reference signature must be set before calculating ROI."
            raise ValueError(_err)

        split_sigs = self.split_sig_randomly(n)
        sample_roi_stats_data = []

        # Initialize a cumulative signature for previous parts
        cumulative_snipe_sig = None
        n = len(split_sigs)
        for i in range(n):
            current_part = split_sigs[i]

            if cumulative_snipe_sig is None:
                cumulative_snipe_sig = current_part
                continue

            # Add the current part to the cumulative signature
            current_part_snipe_sig = cumulative_snipe_sig + current_part

            # Calculate the current part coverage
            current_part_snipe_sig.add_reference_signature(self._reference_signature)
            current_part_coverage_index = (
                current_part_snipe_sig.reference_stats.coverage_index
            )
            current_part_mean_abundance = (
                current_part_snipe_sig.reference_stats.mean_abundance
            )

            # Calculate the cumulative coverage_index up to the previous part
            cumulative_snipe_sig.add_reference_signature(self._reference_signature)
            previous_parts_coverage_index = (
                cumulative_snipe_sig.reference_stats.coverage_index
            )
            previous_parts_mean_abundance = (
                cumulative_snipe_sig.reference_stats.mean_abundance
            )

            # Calculate delta_coverage_index
            delta_coverage_index = (
                current_part_coverage_index - previous_parts_coverage_index
            )

            stats = {
                "current_part_coverage_index": current_part_coverage_index,
                "previous_mean_abundance": previous_parts_mean_abundance,
                "delta_coverage_index": delta_coverage_index,
            }

            sample_roi_stats_data.append(stats)

            # Update the cumulative signature to include the current part
            cumulative_snipe_sig += current_part

        # keep the genomic roi stats data for further analysis
        self.genomic_roi_stats_data = sample_roi_stats_data
        return sample_roi_stats_data

    def get_genomic_roi_stats(self):
        if not self.genomic_roi_stats_data:
            raise ValueError("Genomic ROI stats data is not available.")

        # wasm-friendly format
        return {
            x["previous_mean_abundance"]: x["delta_coverage_index"]
            for x in self.genomic_roi_stats_data
        }

    def get_amplicon_roi_stats(self, amplicon_name=None):
        if not self.amplicons_roi_stats_data:
            raise ValueError("Amplicon stats are not available.")
        if not amplicon_name and len(self.amplicons_roi_stats_data) == 1:
            amplicon_name = list(self.amplicons_roi_stats_data.keys())[0]
        elif amplicon_name:
            if amplicon_name not in self.amplicons_roi_stats_data:
                raise ValueError(
                    f"Amplicon '{amplicon_name}' is not found. Available amplicons are: {list(self.amplicons_roi_stats_data.keys())}"
                )

        # wasm-friendly format
        return {
            x["previous_mean_abundance"]: x["delta_coverage_index"]
            for x in self.amplicons_roi_stats_data[amplicon_name]
        }

    # TODO change the name to calculate_amplicon_roi
    def calculate_exome_roi(self, amplicon_name=None, n=30):
        # check if the signature has a reference signature
        if not self._reference_signature:
            _err = "Reference signature must be set before calculating ROI."
            raise ValueError(_err)

        split_sigs = self.split_sig_randomly(n)
        sample_roi_stats_data = []

        AMPLICON_SIGNATURE_for_ROI = None

        if not len(self._amplicon_signatures):
            raise ValueError(
                "At least one amplicon signatures must be added before calculating ROI."
            )
        if not amplicon_name and len(self._amplicon_signatures) == 1:
            amplicon_name = list(self._amplicon_signatures.keys())[0]
        elif amplicon_name:
            if amplicon_name not in self._amplicon_signatures:
                raise ValueError(
                    f"Amplicon signature '{amplicon_name}' is not found. Available amplicons are: {list(self._amplicon_signatures.keys())}"
                )
            else:
                AMPLICON_SIGNATURE_for_ROI = self._amplicon_signatures[amplicon_name]

        # Initialize a cumulative signature for previous parts
        cumulative_snipe_sig = None
        n = len(split_sigs)
        for i in range(n):
            current_part = split_sigs[i]

            if cumulative_snipe_sig is None:
                cumulative_snipe_sig = current_part
                continue

            # Add the current part to the cumulative signature
            current_part_snipe_sig = cumulative_snipe_sig + current_part

            # Calculate the current part coverage
            # TODO: prevent adding the reference/amplicon signature multiple times
            current_part_snipe_sig.add_reference_signature(self._reference_signature)
            current_part_snipe_sig.add_amplicon_signature(
                AMPLICON_SIGNATURE_for_ROI, "amplicon"
            )

            current_part_coverage_index = current_part_snipe_sig.amplicon_stats[
                "amplicon"
            ].coverage_index
            current_part_mean_abundance = current_part_snipe_sig.amplicon_stats[
                "amplicon"
            ].mean_abundance

            # Calculate the cumulative coverage_index up to the previous part
            cumulative_snipe_sig.add_reference_signature(self._reference_signature)
            cumulative_snipe_sig.add_amplicon_signature(
                AMPLICON_SIGNATURE_for_ROI, "amplicon"
            )
            previous_parts_coverage_index = cumulative_snipe_sig.amplicon_stats[
                "amplicon"
            ].coverage_index
            previous_parts_mean_abundance = cumulative_snipe_sig.amplicon_stats[
                "amplicon"
            ].mean_abundance

            # Calculate delta_coverage_index
            delta_coverage_index = (
                current_part_coverage_index - previous_parts_coverage_index
            )

            stats = {
                "current_part_coverage_index": current_part_coverage_index,
                "previous_mean_abundance": previous_parts_mean_abundance,
                "delta_coverage_index": delta_coverage_index,
            }

            sample_roi_stats_data.append(stats)

            # Update the cumulative signature to include the current part
            cumulative_snipe_sig += current_part

        # keep the genomic roi stats data for further analysis
        self.amplicons_roi_stats_data[amplicon_name] = sample_roi_stats_data
        return sample_roi_stats_data

    def _predict_ROI(self, df, n_predict, show_plot=False):
        if n_predict <= len(df):
            raise ValueError(
                f"n_predict must be greater than the number of training points. Required: more than {len(df)}, Provided: {n_predict}"
            )

        # Check for and handle infinity or NaN values
        if not np.isfinite(df["delta_coverage_index"]).all():
            raise ValueError(
                "Input 'delta_coverage_index' contains infinity or NaN values."
            )

        # Handle zero values by adding a small constant
        df["delta_coverage_index"] = df["delta_coverage_index"].replace(0, np.nan)
        df["delta_coverage_index"] = df["delta_coverage_index"].ffill()

        if (df["delta_coverage_index"] <= 0).any():
            raise ValueError(
                "Input 'delta_coverage_index' must be positive after zero handling."
            )

        # Train with all available data points
        X_train = df[["previous_mean_abundance"]]
        y_train = np.log(df["delta_coverage_index"])

        model = LinearRegression()
        model.fit(X_train, y_train)

        # Calculate the average distance between points on the x-axis
        x_values = df["previous_mean_abundance"].values
        average_distance = np.mean(np.diff(x_values))

        # Generate the x-values for extrapolation
        last_known_value = x_values[-1]
        n_extra = n_predict - len(df)
        extrapolated_values = (
            np.arange(1, n_extra + 1) * average_distance + last_known_value
        )

        # Print the extra increase in the x-axis
        extra_increase = extrapolated_values[-1] - last_known_value
        # print(f"Extra increase in x-axis to achieve new coverage: {extra_increase}")

        extrapolated_values = extrapolated_values.reshape(-1, 1)
        extrapolated_values_df = pd.DataFrame(
            extrapolated_values, columns=["previous_mean_abundance"]
        )
        y_pred_extrapolated = np.exp(model.predict(extrapolated_values_df))


        extrapolated_data = pd.DataFrame(
            {
                "previous_mean_abundance": extrapolated_values.flatten(),
                "delta_coverage_index": y_pred_extrapolated,
            }
        )

        # Calculate the final coverage_index
        last_known_coverage_index = df.iloc[-1]["current_part_coverage_index"]
        extrapolated_data["cumulative_coverage_index"] = (
            last_known_coverage_index
            + extrapolated_data["delta_coverage_index"].cumsum()
        )

        final_coverage_index = extrapolated_data.iloc[-1]["cumulative_coverage_index"]

        combined_data = pd.concat([df, extrapolated_data]).reset_index(drop=True)

        predicted_points = {
            "x": extrapolated_data["previous_mean_abundance"].tolist(),
            "y": extrapolated_data["cumulative_coverage_index"].tolist(),
        }

        return predicted_points, combined_data, final_coverage_index, extra_increase

    def predict_genomic_roi(self, n_predict, show_plot=False):
        if not self.genomic_roi_stats_data:
            raise ValueError("Genomic ROI stats data is not available.")

        df = pd.DataFrame(self.genomic_roi_stats_data)
        predicted_points, combined_data, final_coverage_index, extra_increase = (
            self._predict_ROI(df, n_predict, show_plot)
        )

        return extra_increase, final_coverage_index

    def predict_amplicon_roi(self, amplicon_name, n_predict, show_plot=False):
        if not self.amplicons_roi_stats_data:
            raise ValueError("Amplicon stats are not available.")
        if amplicon_name not in self.amplicons_roi_stats_data:
            raise ValueError(
                f"Amplicon '{amplicon_name}' is not found. Available amplicons are: {list(self.amplicons_roi_stats_data.keys())}"
            )

        df = pd.DataFrame(self.amplicons_roi_stats_data[amplicon_name])
        predicted_points, combined_data, final_coverage_index, extra_increase = (
            self._predict_ROI(df, n_predict, show_plot)
        )

        return extra_increase, final_coverage_index


class Pangenome:
    def __init__(self):
        self._kSize = None
        self._quantitative_sig = None
        self._scale = None
        # counts how many signatures we added
        self._sigs_counter = 0

    def add_signature(self, signature):
        if not isinstance(signature, Signature):
            raise ValueError("Signature must be an instance of Signature.")

        # reset the abundance of the signature to 1
        signature.reset_abundance(new_abundance=1)

        if self._quantitative_sig is None:
            self._quantitative_sig = signature
            self._kSize = signature.k_size
            self._scale = signature.scale

        else:
            if self._kSize != signature.k_size:
                raise ValueError("ksize must be the same")
            if self._scale != signature.scale:
                raise ValueError("scale must be the same")
            self._quantitative_sig += signature

        self._sigs_counter += 1

    #! BUG, return a new signature, don't edit inplace
    def get_pangenome_signature(self, percentage=1.0):
        if self._sigs_counter <= 0:
            raise ValueError("At least one signature must be added to the pangenome.")

        if percentage < 0.1 or percentage > 100:
            raise ValueError("Percentage must be between 0.1 and 100.")

        min_abund_threshold = int(self._sigs_counter * percentage / 100)
        return self._quantitative_sig.select_kmers_min_abund(min_abund_threshold)


def process_sample(
    snipe_sample,
    snipe_genome,
    snipe_amplicon,
    dict_chrs_snipe_sigs,
    biosample_id,
    bioproject_id,
    sample_id,
    assay_type,
):

    result_dict = {
        "SRA Experiment accession": "", #
        "BioSample accession": "", #
        "BioProject accession": "", #
        "SRA Assay type": np.nan, #
        "Number of bases": np.nan, #
        "Library Layout": np.nan, #
        "Total unique k-mers": "", #
        "Genomic unique k-mers": "",
        "Exome unique k-mers": "",
        "Genome coverage index": "",
        "Exome coverage index": "",
        "k-mer total abundance": "",
        "k-mer mean abundance": "",
        "Genomic k-mers total abundance": "",
        "Genomic k-mers mean abundance": "",
        "Genomic k-mers median abundance": "",
        "Exome k-mers total abundance": "",
        "Exome k-mers mean abundance": "",
        "Exome k-mers median abundance": "",
        "Mapping index": "",
        "Predicted contamination index": "",
        "Empirical contamination index": np.nan,
        "Sequencing errors index": "",
        "Autosomal k-mer mean abundance CV": "",
        "Exome enrichment score": "",
        "Predicted Assay type": "",
        "chrX Ploidy score": "",
        "chrY Coverage score": "",
        "Median-trimmed relative coverage": "",
        "Relative mean abundance": "",
        "Relative coverage": "",
        "Coverage of 1fold more sequencing": "",
        "Coverage of 2fold more sequencing": "",
        "Coverage of 5fold more sequencing": "",
        "Coverage of 9fold more sequencing": "",
        "Relative total abundance": "",
    }
    
    
    result_dict["SRA Experiment accession"] = sample_id
    result_dict["SRA Assay type"] = assay_type
    result_dict["BioSample accession"] = biosample_id
    result_dict["BioProject accession"] = bioproject_id
    
    

    # create a signature for the sample
    sample_sig = Signature(k_size=51, signature_type=SigType.SAMPLE)
    sample_sig.load_from_json_string(snipe_sample)
    sample_sig._name = snipe_sample
    
    result_dict["Total unique k-mers"] = len(sample_sig)
    result_dict["k-mer total abundance"] = sample_sig.total_abundance
    result_dict["k-mer mean abundance"] = sample_sig.mean_abundance
    
    

    # create a signature for the genome
    genome_sig = Signature(k_size=51, signature_type=SigType.GENOME)
    # genome_sig.load_from_path("/Users/mabuelanin/dev/snipe/data/genomes/canfam3.1.sig")
    genome_sig.load_from_json_string(snipe_genome)
    genome_sig._name = "canfam3.1"
    
    # create a signature for the amplicon
    amplicon_sig = Signature(k_size=51, signature_type=SigType.AMPLICON)
    amplicon_sig.load_from_json_string(snipe_amplicon)
    
    
    
    # add genome and get genomic stats
    sample_sig.add_reference_signature(genome_sig)
    result_dict["Genomic unique k-mers"] = sample_sig.reference_stats.unique_hashes
    result_dict["Genomic k-mers total abundance"] = sample_sig.reference_stats.total_abundance
    result_dict["Genomic k-mers mean abundance"] = sample_sig.reference_stats.mean_abundance
    result_dict["Genomic k-mers median abundance"] = sample_sig.reference_stats.median_abundance
    result_dict["Genome coverage index"] = sample_sig.reference_stats.coverage_index
    
    # add amplicon and get amplicon stats
    sample_sig.add_amplicon_signature(amplicon_sig, custom_name="amplicon")
    result_dict["Exome unique k-mers"] = sample_sig.amplicon_stats["amplicon"].unique_hashes
    result_dict["Exome k-mers total abundance"] = sample_sig.amplicon_stats["amplicon"].total_abundance
    result_dict["Exome k-mers mean abundance"] = sample_sig.amplicon_stats["amplicon"].mean_abundance
    result_dict["Exome k-mers median abundance"] = sample_sig.amplicon_stats["amplicon"].median_abundance
    result_dict["Exome coverage index"] = sample_sig.amplicon_stats["amplicon"].coverage_index
    
    # relative abundance and coverage
    result_dict["Relative mean abundance"] = sample_sig.amplicon_stats["amplicon"].relative_mean_abundance
    result_dict["Relative coverage"] = sample_sig.amplicon_stats["amplicon"].relative_coverage_index
    result_dict["Relative total abundance"] = result_dict["Exome k-mers total abundance"] / result_dict["Genomic k-mers total abundance"]
    
    
    # median trimmed
    result_dict["Median-trimmed relative coverage"] = sample_sig.amplicon_stats["amplicon"].median_trimmed_relative_coverage_index
    
    _tmp_genome_sig = Signature(k_size=51, signature_type=SigType.SAMPLE)
    _tmp_genome_sig.load_from_json_string(snipe_genome)
    _tmp_amplicon_sig = Signature(k_size=51, signature_type=SigType.SAMPLE)
    _tmp_amplicon_sig.load_from_json_string(snipe_amplicon)
    
    
    # singletons_kmers = count the number of k-mers with abundance = 1 from sample_sig.abundances array
    
    result_dict["Mapping index"] = result_dict["Genomic k-mers total abundance"] / result_dict["k-mer total abundance"]
    
    non_genomic_sampple_sig = sample_sig - genome_sig
    singletons_kmers = np.count_nonzero(non_genomic_sampple_sig.abundances == 1)
    
    
    
    non_genomic_total_abundance = sample_sig.reference_stats.non_ref_total_abundance
    
    
    # predicted contamination index = (non_ref_total_abundance - singletons_kmers) / total_abundance
    result_dict["Predicted contamination index"] = (non_genomic_total_abundance - singletons_kmers) / result_dict["k-mer total abundance"]
    result_dict["Sequencing errors index"] = singletons_kmers / result_dict["k-mer total abundance"]
    
    

    chrs_sigs = {}
    # convert the json string dict_chrs_snipe_sigs to python dict
    dict_chrs_snipe_sigs = json.loads(dict_chrs_snipe_sigs)
    for chr_name, snipe_sig in dict_chrs_snipe_sigs.items():
        chr_sig = Signature(k_size=51, signature_type=SigType.SAMPLE)
        chr_sig.load_from_json_string(snipe_sig)
        chrs_sigs[chr_name] = chr_sig
        chr_sig._name = chr_name
        
    autosomals_w_scaffolds_sig = _tmp_amplicon_sig - chrs_sigs["X"] - chrs_sigs["Y"]

    
    autosomal_chrs_sig = Signature(k_size=51, signature_type=SigType.SAMPLE)
    autosomal_chrs_sig = sum([chrs_sigs[str(chr_name)] for chr_name in range(1, 39)])
    x_sig = chrs_sigs["X"]
    y_sig = chrs_sigs["Y"]
    
    yfree_xchr_in_sample = x_sig & sample_sig
    yfree_autosomals_in_sample = sample_sig & autosomals_w_scaffolds_sig
    
    
    xploidy_score = (yfree_xchr_in_sample.total_abundance / yfree_autosomals_in_sample.total_abundance) * (len(autosomal_chrs_sig) / len(x_sig))
    result_dict["chrX Ploidy score"] = xploidy_score
    
    
    _ychr_coverage = len(sample_sig & y_sig) / len(y_sig)
    _autosomals_coverage = len(sample_sig & autosomal_chrs_sig) / len(autosomal_chrs_sig)
    y_coverage =  _ychr_coverage / _autosomals_coverage
    result_dict["chrY Coverage score"] = y_coverage
    
    chr_to_total_abundance = {}
    for chr_name, chr_sig in chrs_sigs.items():
        common_sig = sample_sig & chr_sig
        chr_to_total_abundance[chr_sig.name] = common_sig.total_abundance
    
    normalized_chr_abundances = {}
    for chr_name, abundance in chr_to_total_abundance.items():
        normalized_abundance = abundance / len(chrs_sigs[chr_name])
        normalized_chr_abundances[chr_name] = normalized_abundance
    
    df = pd.DataFrame.from_dict(normalized_chr_abundances, orient='index', columns=['Abundance'])
    df.index.name = 'Chromosome'
    chromosome_order = [str(i) for i in range(1, 39)] + ['X', 'Y', 'M']
    df = df.reindex(chromosome_order, fill_value=0).reset_index()
    df['Chromosome'] = pd.Categorical(df['Chromosome'], categories=chromosome_order, ordered=True)
    
    chr_mean_abundance = df['Abundance'].mean()
    chr_std_abundance = df['Abundance'].std()
    chrs_CV =  chr_std_abundance / chr_mean_abundance if chr_mean_abundance != 0 else np.nan
    result_dict["Autosomal k-mer mean abundance CV"] = chrs_CV
    

    
    
    genome_non_exome = _tmp_genome_sig - _tmp_amplicon_sig
    sample_genome_non_exome = sample_sig & genome_non_exome
    sample_genome_non_exome_mean_abundance = sample_genome_non_exome.mean_abundance
    
    amplicon_score = result_dict["Median-trimmed relative coverage"] * (result_dict["Exome k-mers mean abundance"] / sample_genome_non_exome_mean_abundance)
    grey_zone_amplicon_score = [3, 7]
    
    # WXS if > grey_zone_amplicon_score[1]
    # WGS if < grey_zone_amplicon_score[0]
    # 'unpredicted' if grey_zone_amplicon_score[0] <= amplicon_score <= grey_zone_amplicon_score[1]
    predicted_assay_type = 'WXS' if amplicon_score > grey_zone_amplicon_score[1] else 'WGS' if amplicon_score < grey_zone_amplicon_score[0] else 'unpredicted'
    result_dict["Predicted Assay type"] = predicted_assay_type
    
    result_dict["Exome enrichment score"] = amplicon_score
    
    
    fold_to_roi_coverage = {}
    if predicted_assay_type == 'WGS':    
        sample_sig.calculate_genomic_roi(5)
        for fold in [9]:
            n_predict = (fold+1) * 5
            extra_increase, final_coverage_index = sample_sig.predict_genomic_roi(n_predict, show_plot=False)
            fold_to_roi_coverage[fold] = final_coverage_index
            
    elif predicted_assay_type == 'WXS':
        sample_sig.calculate_exome_roi("amplicon", 5)
        for fold in [9]:
            n_predict = (fold+1) * 5
            extra_increase, final_coverage_index = sample_sig.predict_amplicon_roi(amplicon_name="exome", n_predict=n_predict, show_plot=False)
            fold_to_roi_coverage[fold] = final_coverage_index
    
    else:
        for fold in [9]:
            fold_to_roi_coverage[fold] = np.nan
    
    
    # result_dict["Coverage of 1fold more sequencing"] = fold_to_roi_coverage[1]
    # result_dict["Coverage of 2fold more sequencing"] = fold_to_roi_coverage[2]
    # result_dict["Coverage of 5fold more sequencing"] = fold_to_roi_coverage[5]
    result_dict["Coverage of 9fold more sequencing"] = fold_to_roi_coverage[9]
    


    # return results as json
    return result_dict

